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
		io = socketio.listen(server);
		io.set('log level', 1);
		io.sockets.on('connection', function (socket) {
			console.log("Connection: ", socket.id);
			socket.on('disconnect', function () {
				console.log("Disconnect: ", socket.id);
			});
		});
		
		var gravity = new Box2D.Common.Math.b2Vec2(0, 0);
		state.world = new Box2D.Dynamics.b2World(gravity,  true);

		// TODO: Encapsulate
		definitions.circleFixture.shape = new Box2D.Collision.Shapes.b2CircleShape();
		definitions.circleFixture.density = 1;
		definitions.circleFixture.restitution = 0.7;

		// const polyFixture = new Box2D.Dynamics.b2FixtureDef()
		// polyFixture.shape = new Box2D.Collision.Shapes.b2PolygonShape();
		// polyFixture.density = 1;

		// const circleFixture = 
		// circleFixture.shape = new Box2D.Collision.Shapes.b2CircleShape();
		// circleFixture.density = 1;
		// circleFixture.restitution = 0.7;

		// const bodyDef =
		// bodyDef.type = Box2D.Dynamics.b2Body.b2_staticBody;

		//down
		// polyFixture.shape.SetAsBox(10, 1);
		// bodyDef.position.Set(9, STAGE_HEIGHT / PX_PER_METER + 1);
		// state.world.CreateBody(bodyDef).CreateFixture(polyFixture);

		//left
		// polyFixture.shape.SetAsBox(1, 100);
		// bodyDef.position.Set(-1, 0);
		// state.world.CreateBody(bodyDef).CreateFixture(polyFixture);

		//right
		// bodyDef.position.Set(STAGE_WIDTH / PX_PER_METER + 1, 0);
		// state.world.CreateBody(bodyDef).CreateFixture(polyFixture);
		// bodyDef.type = Box2D.Dynamics.b2Body.b2_dynamicBody;

		// for (var i = 0; i < 40; i++) {
		// 	bodyDef.position.Set(MathUtil.rndRange(0, STAGE_WIDTH) / PX_PER_METER, -MathUtil.rndRange(50, 5000) / PX_PER_METER);
		// 	var body = state.world.CreateBody(bodyDef);
		// 	var s;
		// 	if (i/40 > 0.5) {
		// 		s = i/40*50+50;
		// 		circleFixture.shape.SetRadius(s / 2 / PX_PER_METER);
		// 		body.CreateFixture(circleFixture);
		// 		state.bodies.push(body);
		// 	}
		// 	else {
		// 		s = i/40*50+50;
		// 		polyFixture.shape.SetAsBox(s / 2 / PX_PER_METER, s / 2 / PX_PER_METER);
		// 		body.CreateFixture(polyFixture);
		// 		state.bodies.push(body);
		// 	}
		// }

		this.addShip({pos: {x: STAGE_WIDTH/2/PX_PER_METER, y: STAGE_HEIGHT/2/PX_PER_METER}});

		setInterval(this.step.bind(this), UPDATE_INTERVAL * 1000);
		setInterval(this.sync.bind(this), UPDATE_INTERVAL * 1000 * ARTIFICIAL_LATENCY_FACTOR);
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
		// console.log(state.world.m_island.m_bodies);
	},
	step: function () {
		state.world.Step(UPDATE_INTERVAL, 3, 3);
		state.world.ClearForces();
	}
};

module.exports = game