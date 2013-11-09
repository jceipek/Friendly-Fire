var socketio = require('socket.io');
var Box2D = require('box2dweb');
var MathUtil = require('./math_helpers');

const ARTIFICIAL_LATENCY_FACTOR = 1; // Make it 1 for no fake latency
const UPDATE_INTERVAL = 1/60;
const STAGE_WIDTH = 1000; // px
const STAGE_HEIGHT = 900; // px
const PX_PER_METER = 100; // conversion
var state = {
	world: null,
	bodies: {}, // instances of b2Body (from Box2D)
	players: {}
};
var definitions = {
	polyFixture: new Box2D.Dynamics.b2FixtureDef(),
	circleFixture: new Box2D.Dynamics.b2FixtureDef(),
	bodyDef: new Box2D.Dynamics.b2BodyDef()
};
var io = null;
var object_tracker = 0; // Increments every time a new object is added

var game = {
	init: function (server) {
		this.initNetwork(server);
		var gravity = new Box2D.Common.Math.b2Vec2(0, 0);
		state.world = new Box2D.Dynamics.b2World(gravity,  true);

		this.initFixtures();

		setInterval(this.step.bind(this), UPDATE_INTERVAL * 1000);
		setInterval(this.sync.bind(this), UPDATE_INTERVAL * 1000 * ARTIFICIAL_LATENCY_FACTOR);
	},
	initFixtures: function () {
		definitions.circleFixture.shape = new Box2D.Collision.Shapes.b2CircleShape();
		definitions.circleFixture.density = 1;
		definitions.circleFixture.restitution = 0.7;
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
			var bullet_id = _g.addBullet({pos: {x: pos.x, y: pos.y}, angle: ship.GetAngle(), vel: ship.GetLinearVelocity()});
			io.sockets.emit('make_objects', [{type: 'bullet', id: bullet_id}]);
			// var player = state.players[socket.id];
			// player.special_properties.destination = loc;
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
			var ship_id = _g.addShip();
			state.players[new_socket.id] = { socket: new_socket, type: ship_type, ship_id: ship_id, special_properties: {} };

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
	removeObject: function (id) {
		io.sockets.emit('remove_objects', [id]);
		state.world.DestroyBody(state.bodies[id]);
		delete state.bodies[id];
	},
	addBullet: function (params) {
		var _g = this;
		params = params || {};
		var pos = params.pos || {x: 0, y: 0},
				angle = params.angle || 0,
				ship_vel = params.vel || {x: 0, y: 0},
				body,
				size;
		var vec = new Box2D.Common.Math.b2Vec2(Math.sin(angle), -Math.cos(angle));
		var vel = new Box2D.Common.Math.b2Vec2(vec.x * 5 + ship_vel.x, vec.y * 5 + ship_vel.y);

		definitions.bodyDef.type = Box2D.Dynamics.b2Body.b2_dynamicBody;
		definitions.bodyDef.position.Set(pos.x + vec.x * 0.3, pos.y + vec.y * 0.3);
		body = state.world.CreateBody(definitions.bodyDef);

		size = 5;
		definitions.circleFixture.shape.SetRadius(size / 2 / PX_PER_METER);
		body.CreateFixture(definitions.circleFixture);
		body.SetAngle(angle);
		body.SetLinearVelocity(vel);
		body.entity_type = 'bullet';
		var id = object_tracker;
		state.bodies[id] = body;
		object_tracker++;
		setTimeout(function () {_g.removeObject(id);}, 5000);
		return id;
	},
	addShip: function (params) {
		params = params || {};
		var pos = params.pos || {x: 0, y: 0},
			body,
			size;

		definitions.bodyDef.type = Box2D.Dynamics.b2Body.b2_dynamicBody;
		definitions.bodyDef.position.Set(pos.x, pos.y);
		body = state.world.CreateBody(definitions.bodyDef);

		size = 50;
		definitions.circleFixture.shape.SetRadius(size / 2 / PX_PER_METER);
		body.CreateFixture(definitions.circleFixture);
		body.entity_type = 'avenger';

		var id = object_tracker;
		state.bodies[id] = body;
		object_tracker++;
		return id;
	},
	sync: function () {
		var data = [];
		for (var b_idx in state.bodies) {
			if (state.bodies.hasOwnProperty(b_idx)) {
				var body = state.bodies[b_idx];
				var position = body.GetPosition();
				var velocity = body.GetLinearVelocity();
				var angular_velocity = body.GetAngularVelocity();
				data.push({ timestamp: (new Date()).getTime(),
										id: b_idx,
										x: position.x,
										y: position.y,
										rot: body.GetAngle(),
										x_vel: velocity.x,
										y_vel: velocity.y,
										a_vel: angular_velocity });
			}
		}
		io.sockets.volatile.emit('update', data);
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
		}
	}
};

module.exports = game