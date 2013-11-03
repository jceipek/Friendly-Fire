var socketio = require('socket.io');
var Box2D = require('box2dweb');
var MathUtil = require('./math_helpers');

var ARTIFICIAL_LATENCY_FACTOR = 1; // Make it 1 for no fake latency

var game = {
	UPDATE_INTERVAL: 1/60,
	STAGE_WIDTH: 1000,
	STAGE_HEIGHT: 900,
	METER: 100,
	state: {
		world: null,
		bodies: [] // instances of b2Body (from Box2D)
	},
	definitions: {
		polyFixture: new Box2D.Dynamics.b2FixtureDef(),
		circleFixture: new Box2D.Dynamics.b2FixtureDef(),
		bodyDef: new Box2D.Dynamics.b2BodyDef()
	},
	init: function (server) {
		var _g = this;

		_g.io = socketio.listen(server);
		_g.io.set('log level', 1);
		_g.io.sockets.on('connection', function (socket) {
			console.log("Connection: ", socket.id);
			socket.on('disconnect', function () {
				console.log("Disconnect: ", socket.id);
			});
		});
		
		var gravity = new Box2D.Common.Math.b2Vec2(0, 0);
		_g.state.world = new Box2D.Dynamics.b2World(gravity,  true);

		// TODO: Encapsulate
		_g.definitions.circleFixture.shape = new Box2D.Collision.Shapes.b2CircleShape();
		_g.definitions.circleFixture.density = 1;
		_g.definitions.circleFixture.restitution = 0.7;

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
		// bodyDef.position.Set(9, _g.STAGE_HEIGHT / _g.METER + 1);
		// _g.state.world.CreateBody(bodyDef).CreateFixture(polyFixture);

		//left
		// polyFixture.shape.SetAsBox(1, 100);
		// bodyDef.position.Set(-1, 0);
		// _g.state.world.CreateBody(bodyDef).CreateFixture(polyFixture);

		//right
		// bodyDef.position.Set(_g.STAGE_WIDTH / _g.METER + 1, 0);
		// _g.state.world.CreateBody(bodyDef).CreateFixture(polyFixture);
		// bodyDef.type = Box2D.Dynamics.b2Body.b2_dynamicBody;

		// for (var i = 0; i < 40; i++) {
		// 	bodyDef.position.Set(MathUtil.rndRange(0, _g.STAGE_WIDTH) / _g.METER, -MathUtil.rndRange(50, 5000) / _g.METER);
		// 	var body = _g.state.world.CreateBody(bodyDef);
		// 	var s;
		// 	if (i/40 > 0.5) {
		// 		s = i/40*50+50;
		// 		circleFixture.shape.SetRadius(s / 2 / _g.METER);
		// 		body.CreateFixture(circleFixture);
		// 		_g.state.bodies.push(body);
		// 	}
		// 	else {
		// 		s = i/40*50+50;
		// 		polyFixture.shape.SetAsBox(s / 2 / _g.METER, s / 2 / _g.METER);
		// 		body.CreateFixture(polyFixture);
		// 		_g.state.bodies.push(body);
		// 	}
		// }

		_g.addShip({pos: {x: _g.STAGE_WIDTH/2/_g.METER, y: _g.STAGE_HEIGHT/2/_g.METER}});

		setInterval(_g.step.bind(_g), _g.UPDATE_INTERVAL * 1000);
		setInterval(_g.sync.bind(_g), _g.UPDATE_INTERVAL * 1000 * ARTIFICIAL_LATENCY_FACTOR);
	},
	addShip: function (params) {
		params = params || {};		
		var _g = this,
				pos = params.pos || {x: 0, y: 0},
				body,
				size;

		_g.definitions.bodyDef.type = Box2D.Dynamics.b2Body.b2_dynamicBody;
		_g.definitions.bodyDef.position.Set(pos.x, pos.y);
		body = _g.state.world.CreateBody(_g.definitions.bodyDef);

		size = 50;
		_g.definitions.circleFixture.shape.SetRadius(size / 2 / _g.METER);
		body.CreateFixture(_g.definitions.circleFixture);

		_g.state.bodies.push(body);
	},
	sync: function () {
		var _g = this,
				data = [];
		const n = _g.state.bodies.length;
		for (var i = 0; i < n; i++) {
			var body  = _g.state.bodies[i];
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
		_g.io.sockets.emit('update', data);
		// console.log(_g.state.world.m_island.m_bodies);
	},
	step: function () {
		var _g = this;
		_g.state.world.Step(_g.UPDATE_INTERVAL, 3, 3);
		_g.state.world.ClearForces();
	}
};

module.exports = game