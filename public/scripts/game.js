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
			var address = window.prompt("Server address", "0.0.0.0");
			this.socket = io.connect('http://' + address + ':5000');

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
			var _g = this;
			world = new Box2D.Dynamics.b2World(new Box2D.Common.Math.b2Vec2(0, 10),  true);

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
			world.CreateBody(bodyDef).CreateFixture(polyFixture);

			//left
			polyFixture.shape.SetAsBox(1, 100);
			bodyDef.position.Set(-1, 0);
			world.CreateBody(bodyDef).CreateFixture(polyFixture);

			//right
			bodyDef.position.Set(_g.STAGE_WIDTH / _g.METER + 1, 0);
			world.CreateBody(bodyDef).CreateFixture(polyFixture);
			bodyDef.type = Box2D.Dynamics.b2Body.b2_dynamicBody;

			for (var i = 0; i < 40; i++) {
				bodyDef.position.Set(MathUtil.rndRange(0, _g.STAGE_WIDTH) / _g.METER, -MathUtil.rndRange(50, 5000) / _g.METER);
				var body = world.CreateBody(bodyDef);
				var s;
				if (Math.random() > 0.5) {
					s = MathUtil.rndRange(70, 100);
					circleFixture.shape.SetRadius(s / 2 / _g.METER);
					body.CreateFixture(circleFixture);
					_g.state.bodies.push(body);

					var ball = new PIXI.Sprite(PIXI.Texture.fromFrame("assets/ball.png"));
					_g.state.stage.addChild(ball);
					ball.i = i;
					ball.anchor.x = ball.anchor.y = 0.5;
					ball.scale.x = ball.scale.y = s / 100;

					_g.state.actors[_g.state.actors.length] = ball;
				}
				else {
					s = MathUtil.rndRange(50, 100);
					polyFixture.shape.SetAsBox(s / 2 / _g.METER, s / 2 / _g.METER);
					body.CreateFixture(polyFixture);
					_g.state.bodies.push(body);

					var box = new PIXI.Sprite(PIXI.Texture.fromFrame("assets/box.jpg"));
					_g.state.stage.addChild(box);
					box.i = i;
					box.anchor.x = box.anchor.y = 0.5;
					box.scale.x = s / 100;
					box.scale.y = s / 100;

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
				actor.position.x = position.x * 100;
				actor.position.y = position.y * 100;
				actor.rotation = body.GetAngle();
			}
			_g.socket.emit('my other event', { my: 'data' });

			_g.state.renderer.render(_g.state.stage);

		},
		sync: function() {
			_g.socket.on('news', function (data) {
				console.log(data);
				_g.socket.emit('my other event', { my: 'data' });
			});
		}
	};

	window.game = game;
	return game;
});