// var io = require('socket.io');
var io;
var Box2D = require('box2dweb');
var MathUtil = require('./math_helpers');

var client_sockets = [];

var game = {
	UPDATE_INTERVAL: 1/60,
	STAGE_WIDTH: 1000,
	STAGE_HEIGHT: 900,
	METER: 100,
	state: {
		world: null,
		bodies: [] // instances of b2Body (from Box2D)
	},
	init: function (server) {
		var _g = this;

		io = require('socket.io').listen(server);
		io.set('log level', 1);
		io.sockets.on('connection', function (socket) {
			console.log("Connect: ", socket.id);
			client_sockets.push(socket);
			socket.on('disconnect', function () {
				console.log("Disconnect: ", socket.id);
				var i = client_sockets.indexOf(socket);
				if (i > -1) client_sockets.splice(i, 1);
			});
		});
		
		var gravity = new Box2D.Common.Math.b2Vec2(0, 10);
		_g.state.world = new Box2D.Dynamics.b2World(gravity,  true);

		const polyFixture = new Box2D.Dynamics.b2FixtureDef();
		polyFixture.shape = new Box2D.Collision.Shapes.b2PolygonShape();
		polyFixture.density = 1;

		const circleFixture = new Box2D.Dynamics.b2FixtureDef();
		circleFixture.shape = new Box2D.Collision.Shapes.b2CircleShape();
		circleFixture.density = 1;
		circleFixture.restitution = 0.7;

		const bodyDef = new Box2D.Dynamics.b2BodyDef();
		bodyDef.type = Box2D.Dynamics.b2Body.b2_staticBody;

		//down
		polyFixture.shape.SetAsBox(10, 1);
		bodyDef.position.Set(9, _g.STAGE_HEIGHT / _g.METER + 1);
		_g.state.world.CreateBody(bodyDef).CreateFixture(polyFixture);

		//left
		polyFixture.shape.SetAsBox(1, 100);
		bodyDef.position.Set(-1, 0);
		_g.state.world.CreateBody(bodyDef).CreateFixture(polyFixture);

		//right
		bodyDef.position.Set(_g.STAGE_WIDTH / _g.METER + 1, 0);
		_g.state.world.CreateBody(bodyDef).CreateFixture(polyFixture);
		bodyDef.type = Box2D.Dynamics.b2Body.b2_dynamicBody;

		for (var i = 0; i < 40; i++) {
			bodyDef.position.Set(MathUtil.rndRange(0, _g.STAGE_WIDTH) / _g.METER, -MathUtil.rndRange(50, 5000) / _g.METER);
			var body = _g.state.world.CreateBody(bodyDef);
			var s;
			if (i/40 > 0.5) {
				s = i/40*50+50;
				circleFixture.shape.SetRadius(s / 2 / _g.METER);
				body.CreateFixture(circleFixture);
				_g.state.bodies.push(body);
			}
			else {
				s = i/40*50+50;
				polyFixture.shape.SetAsBox(s / 2 / _g.METER, s / 2 / _g.METER);
				body.CreateFixture(polyFixture);
				_g.state.bodies.push(body);
			}
		}
		setInterval(_g.update.bind(_g), _g.UPDATE_INTERVAL*1000);
	},
	update: function () {
		var _g = this,
				data = [];
		_g.state.world.Step(_g.UPDATE_INTERVAL, 3, 3);
		_g.state.world.ClearForces();
		// console.log(_g.state.world.m_island.m_bodies);
		const n = _g.state.bodies.length;
		for (var i = 0; i < n; i++) {
			var body  = _g.state.bodies[i];
			var position = body.GetPosition();
			data.push({x: position.x, y: position.y, rot: body.GetAngle()});
		}
		for (var i = 0; i < client_sockets.length; i++) {
			var socket = client_sockets[i];
			socket.emit('update', data);
		}
	}
};

module.exports = game