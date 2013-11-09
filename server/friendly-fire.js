var Box2D = require('box2dweb');
var socketio = require('socket.io');
var MathUtil = require('./math_helpers');
var EntityManager = require('./entity_creator');

const ARTIFICIAL_LATENCY_FACTOR = 1; // Make it 1 for no fake latency
const UPDATE_INTERVAL = 1/60;
const STAGE_WIDTH = 1000; // px
const STAGE_HEIGHT = 900; // px
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

		EntityManager.initWithState(state);

		setInterval(this.step.bind(this), UPDATE_INTERVAL * 1000);
		setInterval(this.sync.bind(this), UPDATE_INTERVAL * 1000 * ARTIFICIAL_LATENCY_FACTOR);

		for (var i = 0; i < 5; i++) {
			var enemyID = EntityManager.addShip({type: 'enemy', pos: {x: 2, y: 2}});
			state.enemies[enemyID] = state.bodies[enemyID];
		}
	},
	initInputHandling: function (socket) {
		var _g = this;
		var player = state.players[socket.id];
		var ship = state.bodies[player.ship_id];

		// socket.on('move', function (vector) {
		// 	var body = state.bodies[players[socket.id].ship_id];
		// 	body.ApplyForce(new Box2D.Common.Math.b2Vec2(vector.x * 10, vector.y * 10), body.GetWorldCenter());
		// });
		socket.on('set_destination', function (destination) {
			player.destination = destination;
		});
		socket.on('fire', function (time) {
			var pos = ship.GetPosition();
			var bullet_id = EntityManager.addBullet({pos: {x: pos.x, y: pos.y}, angle: ship.GetAngle(), ship_vel: ship.GetLinearVelocity(), bullet_speed: 10});
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
					other_objects.push({type: obj.entity_type, id: obj_idx});
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
				var v2mult = function(vec, scalar) {
					return new Box2D.Common.Math.b2Vec2(vec.x * scalar, vec.y * scalar);
				};
				var v2add = function(vec1, vec2) {
					return new Box2D.Common.Math.b2Vec2(vec2.x + vec1.x, vec2.y + vec1.y);
				};
				var v2sub = function(vec1, vec2) {
					return new Box2D.Common.Math.b2Vec2(vec2.x - vec1.x, vec2.y - vec1.y);
				};
				var v2norm = function(vec) {
					var mag = v2mag(vec);
					return new Box2D.Common.Math.b2Vec2(vec.x / mag, vec.y / mag);
				};
				var v2mag = function(vec) {
					return Mathf.sqrt(vec.x * vec.x + vec.y * vec.y);
				}

				var enemy_body = state.enemies[enemy_idx];
				var pos = enemy_body.GetPosition();

				var minDistance = 99999999;
				var target = null;

				for (var player_idx in state.players) {
					/*
					var player = state.players[player_idx];
					var distance = v2mag(v2sub(player.GetPosition(), pos));
					if (distance < minDistance) {
						target = player.GetPosition();
						minDistance = distance;
					}*/
					var player = state.players[player_idx];
					target = player.GetPosition();
				}

				if (!target) target = pos;

				var distanceOffset = 10;
				//target = v2add(target, v2mult(v2norm(target, pos)), -1 * distanceOffset));

				state.bodies[enemy_body.ship_id].destionation = target;
			}
		}
	},
	step: function () {
		state.world.Step(UPDATE_INTERVAL, 3, 3);
		state.world.ClearForces();
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
			if (state.players.hasOwnProperty(enemy_idx)) {
				var enemy = state.enemies[enemy_idx],
						loc = enemy.destination,
						ship = state.bodies[enemy.ship_id],
						ship_loc = ship.GetPosition();
				this.updateShip(enemy, loc, ship, ship_loc);
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
			des_angle = Math.atan2(vec.x, -vec.y);
			// var next_angle = (ship.GetAngle() + ship.GetAngularVelocity()) / 3;
			// var total_rotation = des_angle - next_angle;
			// ship.ApplyTorque(total_rotation < 0 ? -10 : 10);
			if (adjust_angle) {ship.SetAngle(des_angle);
								ship.ApplyForce(vec, ship.GetWorldCenter());}
		}
	}
};

module.exports = game;
