var Box2D = require('box2dweb');
var socketio = require('socket.io');
var MathUtil = require('./math_helpers');
var EntityManager = require('./entity_creator');
var SongAnalysis = require('./helix');

const ARTIFICIAL_LATENCY_FACTOR = 1; // Make it 1 for no fake latency
const UPDATE_INTERVAL = 1/60;
var state = {
	world: null,
	// TODO: duplicate code with managing bodies and enemies and players
	// need to remember to delete a body when you delete a player
	// need to remember to delete a body when you delete an enemy
	// somehow combine bodies, players, enemies, logically
	bodies: {}, // instances of b2Body (from Box2D)

	// TODO: right now each player has only one body, but some ships may have multiple bodies
	players: {},
	enemies: {},
	song_start_time: 0,
	song_time_ms: 1000*0,
	song_beat_idx: 0,
	song_section_idx: 0,
	song_segment_idx: 0,
	song_bar_idx: 0,
	last_jump_back: (new Date()).getTime(),
	to_delete: [],
	crazy_timeout: []
};

var io = null;

var game = {
	init: function (server) {
		// set up websocket
		this.initNetwork(server);

		// set up box2d
		var gravity = new Box2D.Common.Math.b2Vec2(0, 0);
		state.world = new Box2D.Dynamics.b2World(gravity,  true);
		var listener = new Box2D.Dynamics.b2ContactListener;
		listener.BeginContact = this.onContact;
		state.world.SetContactListener(listener);

		// TODO: refactor entitymanager
		EntityManager.initWithState(state);

		setInterval(this.step.bind(this), UPDATE_INTERVAL * 1000);
		setInterval(this.sync.bind(this), UPDATE_INTERVAL * 1000 * ARTIFICIAL_LATENCY_FACTOR);

		state.song_start_time = (new Date()).getTime();
	},
	initInputHandling: function (socket) {
		var _g = this;
		var player = state.players[socket.id];
		var ship = state.bodies[player.ship_id];

		socket.on('set_destination', function (destination) {
			player.destination = destination;
		});

		socket.on('fire', function (time) {
			var pos = ship.GetPosition();
			var bullet_params = {
				pos: {x: pos.x, y: pos.y},
				angle: ship.GetAngle(),
				ship_vel: ship.GetLinearVelocity(),
				bullet_speed: 10,
				bullet_class: 'player'
			};

			// TODO: entity manager tells clients to create object
			var bullet_id = EntityManager.addBullet(bullet_params);
			setTimeout(function () {_g.removeObject(bullet_id);}, 5000);
			io.sockets.emit('make_objects', [{type: 'bullet', id: bullet_id}]);
		});
	},
	initNetwork: function (server) {
		io = socketio.listen(server);
		io.set('log level', 1);
		io.sockets.on('connection', this.createPlayer.bind(this));
	},
	createPlayer: function (new_socket) {
		var _g = this;
		console.log("Connection: ", new_socket.id);
		var ship_type = 'avenger';
		var other_objects = [];
		for (var obj_idx in state.bodies) {
			if (state.bodies.hasOwnProperty(obj_idx)) {
				var obj = state.bodies[obj_idx];
				other_objects.push({type: obj.GetUserData().entity_type, id: obj_idx});
			}
		}
		// To new player: create objects that exist on the server
		new_socket.emit('make_objects', other_objects);
		var ship_id = EntityManager.addShip();
		state.players[new_socket.id] = { socket: new_socket, type: ship_type, ship_id: ship_id };

		// To new player: sync song playback time
		new_socket.emit('set_song_time', state.song_time_ms);

		// To everyone: create a new ship for the new player
		io.sockets.emit('make_objects', [{type: ship_type, id: ship_id}]);

		// To new player: assign control of the new ship
		new_socket.emit('assign_ship', ship_id);
		_g.initInputHandling(new_socket);

		new_socket.on('disconnect', function () {
			console.log("Disconnect: ", new_socket.id);
			_g.removeObject(state.players[new_socket.id].ship_id);
			delete state.players[new_socket.id];
		});
	},
	sync: function () {
		var data = [];
		for (var b_idx in state.bodies) {
			if (state.bodies.hasOwnProperty(b_idx)) {
				var body = state.bodies[b_idx];
				var position = body.GetPosition();
				var velocity = body.GetLinearVelocity();
				var angular_velocity = body.GetAngularVelocity();
				data.push({ id: b_idx,
										x: position.x,
										y: position.y,
										rot: body.GetAngle(),
										x_vel: velocity.x,
										y_vel: velocity.y,
										a_vel: angular_velocity });
			}
		}
		io.sockets.volatile.emit('update', { timestamp: (new Date()).getTime(),
																			   data: data });
	},
	removeObject: function (id) {
		io.sockets.emit('remove_objects', [id]);
		EntityManager._removeObject(id);
	},
	fireAI: function () {
		var bullets = [];
		for (var enemy_idx in state.enemies) {
			if (state.enemies.hasOwnProperty(enemy_idx)) {
				var enemy_body = state.enemies[enemy_idx];
				var pos = enemy_body.GetPosition();
				var bullet_id = EntityManager.addBullet({pos: {x: pos.x, y: pos.y},
					                                       angle: enemy_body.GetAngle(),
					                                       ship_vel: enemy_body.GetLinearVelocity(),
					                                       bullet_speed: 15,
					                                     	 bullet_class: 'enemy'});
				var t = this;
				setTimeout(function (bullet_id) {t.removeObject(bullet_id);}, 2000, [bullet_id]);
				//setTimeout(function () {t.removeObject(bullet_id);}, 5000); // Crashes for some strange version
				bullets.push({type: 'bullet', id: bullet_id});
			}
		}
		io.sockets.emit('make_objects', bullets);
	},
	stepMusic: function () {
		state.song_time_ms = (new Date()).getTime() - state.song_start_time;
		//console.log(state.song_beat_idx);
		var curr_beat = SongAnalysis.beats[state.song_beat_idx];
		var next_beat = SongAnalysis.beats[state.song_beat_idx + 1];
		if (curr_beat) {
			if (curr_beat.start*1000 < state.song_time_ms) {
				state.song_beat_idx++;
			}
			if (next_beat && (next_beat.start > curr_beat.start)) {
				var diff = next_beat.start*1000 - state.song_time_ms;
				state.crazy_timeout.push(setTimeout(this.fireAI.bind(this), diff));
				state.song_beat_idx++;
			}
		}

		// USE SECTIONS FOR LARGE GROUPS OR TRANSITIONS

		var curr_bar = SongAnalysis.bars[state.song_bar_idx];
		var next_bar = SongAnalysis.bars[state.song_bar_idx + 1];
		if (curr_bar) {
			if (curr_bar.start*1000 < state.song_time_ms) {
				state.song_bar_idx++;
			}
			if (next_bar && (next_bar.start > curr_bar.start)) {
				var diff = next_bar.start*1000 - state.song_time_ms;
				if (next_bar.confidence > 0.0) {
					state.crazy_timeout.push(setTimeout(function () {
							var enemyID = EntityManager.addShip({type: 'enemy', pos: {x: 2, y: 2}});
							io.sockets.emit('make_objects', [{type: 'enemy', id: enemyID}]);
							state.enemies[enemyID] = state.bodies[enemyID];
					}, diff));
				}
				state.song_bar_idx++;
			}
		}

		var curr_section = SongAnalysis.sections[state.song_section_idx];
		var next_section = SongAnalysis.sections[state.song_section_idx + 1];
		if (curr_section) {
			if (curr_section.start*1000 < state.song_time_ms) {
				state.song_section_idx++;
			}
			if (next_section && (next_section.start > curr_section.start)) {
				var diff = next_section.start*1000 - state.song_time_ms;
				if (next_section.confidence > 0.0) {
					state.crazy_timeout.push(setTimeout(function () {
							for (var j = 0; j < 10; j++) {
								var enemyID = EntityManager.addShip({type: 'enemy', pos: {x: 2, y: 2}});
								io.sockets.emit('make_objects', [{type: 'enemy', id: enemyID}]);
								state.enemies[enemyID] = state.bodies[enemyID];
							}
					}, diff));
				}
				state.song_section_idx++;
			}
		}
	},
	stepAI: function () {
		var min_distance;
		var distance;
		var player_position;
		var enemy_position;
		var enemy_body;
		var target = null;

		for (var enemy_idx in state.enemies) {
			if (state.enemies.hasOwnProperty(enemy_idx)) {
				enemy_body = state.enemies[enemy_idx];
				enemy_position = enemy_body.GetPosition();
				min_distance = 10000;
				// TODO: Fix bug. Shuold get the closest player but right now just
				// gets an arbitrary player.

				for (var player_idx in state.players) {
					if (state.players.hasOwnProperty(player_idx)) {
						var player = state.players[player_idx];
						if (state.bodies[player.ship_id]) {
							player_position = state.bodies[player.ship_id].GetPosition().Copy();
							distance = Math.sqrt(
								Math.pow(player_position.x - enemy_position.x, 2)
								+ Math.pow(player_position.y - enemy_position.y, 2)
							)
							if (distance < min_distance) {
								min_distance = distance;
								target = player_position;
							}
						}
					}
				}

				if (!target) {
					target = enemy_position.Copy();
				}

				enemy_body.destination = target;
			}
		}
	},
	step: function () {
		while (state.to_delete.length > 0) {
			this.removeObject(state.to_delete.pop());
		}

		state.world.Step(UPDATE_INTERVAL, 3, 3);
		state.world.ClearForces();
		this.stepAI();
		this.stepMusic();
		for (var player_idx in state.players) {
			if (state.players.hasOwnProperty(player_idx)) {
				var player = state.players[player_idx],
						loc = player.destination,
						ship = state.bodies[player.ship_id],
						ship_loc = ship.GetPosition();
				this.updateShip(player, loc, ship, ship_loc);
			}
		}
		for (var enemy_idx in state.enemies) {
			if (state.enemies.hasOwnProperty(enemy_idx)) {
				var enemy = state.enemies[enemy_idx],
						loc = enemy.destination,
						ship = state.bodies[enemy_idx];
				if (ship) {
					var ship_loc = ship.GetPosition();
					this.updateShip(enemy, loc, ship, ship_loc);
				}
			}
		}
	},
	updateShip: function(player, loc, ship, ship_loc) {
		if (loc) {
			var k = 6,
					des_angle;
			vec = new Box2D.Common.Math.b2Vec2((loc.x - ship_loc.x), (loc.y - ship_loc.y));
			var adjust_angle = vec.Normalize() > 0.2;

			vec = new Box2D.Common.Math.b2Vec2(vec.x * k, vec.y * k);
			ship.m_linearDamping = 3;
			ship.m_angularDamping = 60;
			des_angle = Math.atan2(vec.x, -vec.y);
			var next_angle = (ship.GetAngle() + ship.GetAngularVelocity()) / 3;
			var total_rotation = des_angle - next_angle;
			ship.ApplyTorque(total_rotation < 0 ? -10 : 10);
			if (adjust_angle) {ship.SetAngle(des_angle);
								ship.ApplyForce(vec, ship.GetWorldCenter());}
		}
	},
	onContact: function (contact) {
		var entity1 = contact.GetFixtureA().GetBody().GetUserData();
		var entity2 = contact.GetFixtureB().GetBody().GetUserData();
		var entities = [entity1, entity2];

		// bullet class is by whom the shot was fired

		if (entity1.entity_type === 'bullet' &&
			entity1.bullet_class === 'enemy' &&
			entity2.entity_type === 'avenger') {
		}

		if (entity2.entity_type === 'bullet' &&
			  entity2.bullet_class === 'enemy' &&
			  entity1.entity_type === 'avenger') {
		}

		if (entity2.entity_type === 'bullet' &&
			entity2.bullet_class === 'enemy') {
		}

		if (entity1.entity_type === 'bullet' &&
			entity1.bullet_class === 'enemy') {
		}

		if (entity1.entity_type === 'bullet' &&
			  entity1.bullet_class === 'player' &&
			  entity2.entity_type === 'enemy') {
			state.to_delete.push(entity2.id);
		}
		if (entity2.entity_type === 'bullet' &&
			entity2.bullet_class === 'player' &&
			entity1.entity_type === 'enemy') {
			state.to_delete.push(entity1.id);
		}

		var i;
		for (i = 0; i < entities.length; i++) {
			if (entities[i].entity_type === 'bullet') {
				state.to_delete.push(entities[i].id);
			}
		}
	}
};

module.exports = game;
