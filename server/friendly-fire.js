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
	bodies: [] // instances of b2Body (from Box2D)
};
var definitions = {
	polyFixture: new Box2D.Dynamics.b2FixtureDef(),
	circleFixture: new Box2D.Dynamics.b2FixtureDef(),
	bodyDef: new Box2D.Dynamics.b2BodyDef()
};
var io = null;

var game = {
	init: function (server) {
		this.initNetwork(server);
		var gravity = new Box2D.Common.Math.b2Vec2(0, 0);
		state.world = new Box2D.Dynamics.b2World(gravity,  true);

		this.initFixtures();

		this.addShip({pos: {x: STAGE_WIDTH/2/PX_PER_METER, y: STAGE_HEIGHT/2/PX_PER_METER}});

		setInterval(this.step.bind(this), UPDATE_INTERVAL * 1000);
		setInterval(this.sync.bind(this), UPDATE_INTERVAL * 1000 * ARTIFICIAL_LATENCY_FACTOR);
	},
	initFixtures: function () {
		definitions.circleFixture.shape = new Box2D.Collision.Shapes.b2CircleShape();
		definitions.circleFixture.density = 1;
		definitions.circleFixture.restitution = 0.7;
	},
	initInputHandling: function (socket) {
		socket.on('move', function (vector) {
			state.bodies[0].ApplyForce(new Box2D.Common.Math.b2Vec2(vector.x * 10, vector.y * 10), state.bodies[0].GetWorldCenter());
		});
	},
	initNetwork: function (server) {
		var _g = this;
		io = socketio.listen(server);
		io.set('log level', 1);
		io.sockets.on('connection', function (socket) {
			console.log("Connection: ", socket.id);
			_g.initInputHandling(socket);
			socket.on('disconnect', function () {
				console.log("Disconnect: ", socket.id);
			});
		});
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

		state.bodies.push(body);
	},
	sync: function () {
		var data = [];
		const n = state.bodies.length;
		for (var i = 0; i < n; i++) {
			var body  = state.bodies[i];
			var position = body.GetPosition();
			var velocity = body.GetLinearVelocity();
			var angular_velocity = body.GetAngularVelocity();
			data.push({ x: position.x,
									y: position.y,
									rot: body.GetAngle(),
									x_vel: velocity.x,
									y_vel: velocity.y,
									a_vel: angular_velocity });
		}
		io.sockets.emit('update', data);
	},
	step: function () {
		state.world.Step(UPDATE_INTERVAL, 3, 3);
		state.world.ClearForces();
	}
};

module.exports = game