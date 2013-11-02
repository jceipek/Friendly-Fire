define(['zepto', 'pixi', 'box2d', 'helpers/math', 'socketio'], function ($, PIXI, Box2D, MathUtil, io) {

	var game = {
		state: {
			stage: null,
			renderer: null,
			world: null,
			bodies: [], // instances of b2Body (from Box2D)
			actors: []
		},

		STAGE_WIDTH: window.innerWidth,
		STAGE_HEIGHT: window.innerHeight,
		METER: 100,
		init: function () {
			var _g = this;

			// create a connection to the server
			var address = location.host;
			_g.socket = io.connect('http://' + address);
			_g.socket.on('update', _g.sync.bind(_g));

			const container = document.createElement("div");
			document.body.appendChild(container);

			_g.state.stage = new PIXI.Stage(0xDDDDDD, true);
			_g.state.renderer = PIXI.autoDetectRenderer(_g.STAGE_WIDTH, _g.STAGE_HEIGHT, undefined, false);
			document.body.appendChild(_g.state.renderer.view);

			const loader = new PIXI.AssetLoader(["assets/ball.png",
				"assets/box.jpg"]);
			loader.onComplete = _g.onLoadAssets.bind(_g);
			loader.load();
		},
		onLoadAssets: function () {
			var _g = this,
					gravity = new Box2D.Common.Math.b2Vec2(0, 10);
			
			_g.sync();

			world = new Box2D.Dynamics.b2World(gravity,  true);

			const polyFixture = new Box2D.Dynamics.b2FixtureDef();
			polyFixture.shape = new Box2D.Collision.Shapes.b2PolygonShape();
			polyFixture.density = 1;

			const circleFixture = new Box2D.Dynamics.b2FixtureDef();
			circleFixture.shape = new Box2D.Collision.Shapes.b2CircleShape();
			circleFixture.density = 1;
			circleFixture.restitution = 0.7;

			const bodyDef = new Box2D.Dynamics.b2BodyDef();
			bodyDef.type = Box2D.Dynamics.b2Body.b2_kinematicBody;

			for (var i = 0; i < 40; i++) {
				bodyDef.position.Set(MathUtil.rndRange(0, _g.STAGE_WIDTH) / _g.METER, -MathUtil.rndRange(50, 5000) / _g.METER);
				var body = world.CreateBody(bodyDef);
				var s;
				if (i/40 > 0.5) {
					s = i/40*50+50;
					circleFixture.shape.SetRadius(s / 2 / _g.METER);
					body.CreateFixture(circleFixture);
					_g.state.bodies.push(body);

					var ball = new PIXI.Sprite(PIXI.Texture.fromFrame("assets/ball.png"));
					_g.state.stage.addChild(ball);
					ball.i = i;
					ball.anchor.x = ball.anchor.y = 0.5;
					ball.scale.x = ball.scale.y = s / _g.METER;

					_g.state.actors[_g.state.actors.length] = ball;
				}
				else {
					s = i/40*50+50;
					polyFixture.shape.SetAsBox(s / 2 / _g.METER, s / 2 / _g.METER);
					body.CreateFixture(polyFixture);
					_g.state.bodies.push(body);

					var box = new PIXI.Sprite(PIXI.Texture.fromFrame("assets/box.jpg"));
					_g.state.stage.addChild(box);
					box.i = i;
					box.anchor.x = box.anchor.y = 0.5;
					box.scale.x = s / _g.METER;
					box.scale.y = s / _g.METER;

					_g.state.actors[_g.state.actors.length] = box;
				}
			}
			_g.update();
		},
		update: function () {
			var _g = this;
			requestAnimationFrame(_g.update.bind(_g));
			world.Step(1 / 60,  3,  3);
			world.ClearForces();

			const n = _g.state.actors.length;
			for (var i = 0; i < n; i++) {
				var body  = _g.state.bodies[i];
				var actor = _g.state.actors[i];
				var position = body.GetPosition();
				actor.position.x = position.x * _g.METER;
				actor.position.y = position.y * _g.METER;
				actor.rotation = body.GetAngle();
			}
			_g.state.renderer.render(_g.state.stage);
		},
		sync: function(data) {
			var _g = this;
			if (!data) {
				return;
			}
			var n = data.length;
			for (var i = 0; i < n; i++) {
				var body = _g.state.bodies[i],
						d = data[i],
						x = d.x,
						y = d.y,
						x_vel = d.x_vel,
						y_vel = d.y_vel,
						a_vel = d.a_vel,
						rot = d.rot,
						pos = new Box2D.Common.Math.b2Vec2(x, y)
						vel = new Box2D.Common.Math.b2Vec2(x_vel, y_vel);

				body.SetPosition(pos);
				body.SetLinearVelocity(vel);
				body.SetAngularVelocity(a_vel);
				body.SetAngle(rot);
			}
		}
	};

	window.game = game;
	return game;
});