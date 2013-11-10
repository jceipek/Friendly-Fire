var Box2D = require('box2dweb');
var socketio = require('socket.io');
var MathUtil = require('./math_helpers');
var EntityManager = require('./entity_creator');
var SongAnalysis = require('./helix');

const ARTIFICIAL_LATENCY_FACTOR = 1; // Make it 1 for no fake latency
const UPDATE_INTERVAL = 1/60;
//const STAGE_WIDTH = 1000; // px
//const STAGE_HEIGHT = 900; // px
var state = {
	world: null,
	bodies: {}, // instances of b2Body (from Box2D)
	players: {},
	enemies: {}
};

var io = null;

var game = {
	init: function (server) {
		this.initNetwork(server);
		var gravity = new Box2D.Common.Math.b2Vec2(0, 0);
		state.world = new Box2D.Dynamics.b2World(gravity,  true);
		var listener = new Box2D.Dynamics.b2ContactListener;
		var _g = this;
		listener.BeginContact = function (contact) {
			var entity1 = contact.GetFixtureA().GetBody().GetUserData();
			var entity2 = contact.GetFixtureB().GetBody().GetUserData();
			if (entity1.entity_type === 'bullet' &&
				  entity1.bullet_class === 'player' &&
				  entity2.entity_type === 'enemy') {
				_g.removeObject(entity2.id);
			}
			if (entity2.entity_type === 'bullet' &&
				entity2.bullet_class === 'player' &&
				entity1.entity_type === 'enemy') {
				_g.removeObject(entity1.id);
			}
			if (entity1.entity_type === 'bullet' &&
				  entity1.bullet_class === 'enemy') {
				_g.removeObject(entity1.id);
			}
			if (entity2.entity_type === 'bullet' &&
				entity2.bullet_class === 'enemy') {
				_g.removeObject(entity2.id);
			}
		};
		state.world.SetContactListener(listener);

		EntityManager.initWithState(state);

		setInterval(this.step.bind(this), UPDATE_INTERVAL * 1000);
		setInterval(this.sync.bind(this), UPDATE_INTERVAL * 1000 * ARTIFICIAL_LATENCY_FACTOR);

		for (var i = 0; i < SongAnalysis.beats.length; i++) {
			var beat = SongAnalysis.beats[i];
			setTimeout(function () {
				console.log("BEAT");
				var enemyID = EntityManager.addShip({type: 'enemy', pos: {x: 2, y: 2}});
				io.sockets.emit('make_objects', [{type: 'enemy', id: enemyID}]);
				state.enemies[enemyID] = state.bodies[enemyID];
			}, beat.start*1000);
		}
		// console.log(SongAnalysis.beats);
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
			var bullet_id = EntityManager.addBullet({pos: {x: pos.x, y: pos.y},
																					     angle: ship.GetAngle(),
																					     ship_vel: ship.GetLinearVelocity(),
																					     bullet_speed: 10,
																					   	 bullet_class: 'player'});
			setTimeout(function () {_g.removeObject(bullet_id);}, 5000);
			io.sockets.emit('make_objects', [{type: 'bullet', id: bullet_id}]);
		});
	},
	initNetwork: function (server) {
		var _g = this;
		io = socketio.listen(server);
		io.set('log level', 1);
		io.sockets.on('connection', function (new_socket) {
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
	stepAI: function () {
		for (var enemy_idx in state.enemies) {
			if (state.enemies.hasOwnProperty(enemy_idx)) {
				var enemy_body = state.enemies[enemy_idx];
				var pos = enemy_body.GetPosition();

				var target = null;

				for (var player_idx in state.players) {
					if (state.players.hasOwnProperty(player_idx)) {
						var player = state.players[player_idx];
						if (state.bodies[player.ship_id]) {
							target = state.bodies[player.ship_id].GetPosition().Copy();
						}
					}
				}

				if (!target) target = pos.Copy();

				var distanceOffset = 10;
				var offset = new Box2D.Common.Math.b2Vec2(target.x, target.y);
				offset.Subtract(pos);
				offset.Normalize();
				offset.Multiply(-1 /* distanceOffset*/);
				target.Add(offset);

				if (state.bodies[enemy_idx]) {
					//console.log("setting destination to: (" + target.x + ", " + target.y  + ")");
					state.bodies[enemy_idx].destination = target;

					var dest = state.bodies[enemy_idx].destination;
					var toDest = dest.Copy();
				   	toDest.Subtract(pos);
					toDest.Normalize();
					var dir = state.bodies[enemy_idx].GetLinearVelocity().Copy();
					dir.Normalize();
					var dotp = dir.x * toDest.x + dir.y * toDest.y;
					var angle = Math.acos(dotp);
					var fov = 0.349;

					var fireDelta = 500;
					if (Math.abs(angle) < fov) {
						var now = (new Date()).getTime();
						if (!enemy_body.lastfiredTime || (now - enemy_body.lastfiredTime) >= fireDelta) {
							enemy_body.lastfiredTime = now;
							var bullet_id = EntityManager.addBullet({pos: {x: pos.x, y: pos.y},
								                                       angle: state.bodies[enemy_idx].GetAngle(),
								                                       ship_vel: state.bodies[enemy_idx].GetLinearVelocity(),
								                                       bullet_speed: 15,
								                                     	 bullet_class: 'enemy'});
							var t = this;
							setTimeout(function (bullet_id) {t.removeObject(bullet_id);}, 2000, [bullet_id]);
							//setTimeout(function () {t.removeObject(bullet_id);}, 5000); // Crashes for some strange version
							io.sockets.emit('make_objects', [{type: 'bullet', id: bullet_id}]);
						}
					}
				}

			}
		}
	},
	step: function () {
		state.world.Step(UPDATE_INTERVAL, 3, 3);
		state.world.ClearForces();
		this.stepAI();
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
	}
};

module.exports = game;
