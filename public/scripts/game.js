define(['zepto', 'pixi', 'box2d', 'helpers/math', 'socketio'], function ($, PIXI, Box2D, MathUtil, io) {
	const STAGE_WIDTH = window.innerWidth;
	const STAGE_HEIGHT = window.innerHeight;
	const METER = 100;

	var state = {
			stage: null,
			renderer: null,
			world: null,
			bodies: [], // instances of b2Body (from Box2D)
			actors: []
	};

	var definitions = {
			polyFixture: new Box2D.Dynamics.b2FixtureDef(),
			circleFixture: new Box2D.Dynamics.b2FixtureDef(),
			bodyDef: new Box2D.Dynamics.b2BodyDef()
	};

	var socket = null;

	var game = {

		init: function () {
			// create a connection to the server
			var address = location.host;
			socket = io.connect('http://' + address);
			socket.on('update', this.sync.bind(this));

			const container = document.createElement("div");
			document.body.appendChild(container);

			state.stage = new PIXI.Stage(0xDDDDDD, true);
			state.renderer = PIXI.autoDetectRenderer(STAGE_WIDTH, STAGE_HEIGHT, undefined, false);
			document.body.appendChild(state.renderer.view);

			const loader = new PIXI.AssetLoader(["assets/ball.png",
				"assets/avenger.png"]);
			loader.onComplete = this.onLoadAssets.bind(this);
			loader.load();
		},
		onLoadAssets: function () {
			var gravity = new Box2D.Common.Math.b2Vec2(0, 0);
			
			this.sync();

			state.world = new Box2D.Dynamics.b2World(gravity,  true);

			definitions.circleFixture.shape = new Box2D.Collision.Shapes.b2CircleShape();
			definitions.circleFixture.density = 1;
			definitions.circleFixture.restitution = 0.7;

			// const polyFixture = new Box2D.Dynamics.b2FixtureDef();
			// polyFixture.shape = new Box2D.Collision.Shapes.b2PolygonShape();
			// polyFixture.density = 1;

			// const circleFixture = new Box2D.Dynamics.b2FixtureDef();
			// circleFixture.shape = new Box2D.Collision.Shapes.b2CircleShape();
			// circleFixture.density = 1;
			// circleFixture.restitution = 0.7;

			// const bodyDef = new Box2D.Dynamics.b2BodyDef();
			// bodyDef.type = Box2D.Dynamics.b2Body.b2_kinematicBody;

			// for (var i = 0; i < 40; i++) {
			// 	bodyDef.position.Set(MathUtil.rndRange(0, STAGE_WIDTH) / METER, -MathUtil.rndRange(50, 5000) / METER);
			// 	var body = world.CreateBody(bodyDef);
			// 	var s;
			// 	if (i/40 > 0.5) {
			// 		s = i/40*50+50;
			// 		circleFixture.shape.SetRadius(s / 2 / METER);
			// 		body.CreateFixture(circleFixture);
			// 		state.bodies.push(body);

			// 		var ball = new PIXI.Sprite(PIXI.Texture.fromFrame("assets/ball.png"));
			// 		state.stage.addChild(ball);
			// 		ball.i = i;
			// 		ball.anchor.x = ball.anchor.y = 0.5;
			// 		ball.scale.x = ball.scale.y = s / METER;

			// 		state.actors[state.actors.length] = ball;
			// 	}
			// 	else {
			// 		s = i/40*50+50;
			// 		polyFixture.shape.SetAsBox(s / 2 / METER, s / 2 / METER);
			// 		body.CreateFixture(polyFixture);
			// 		state.bodies.push(body);

			// 		var box = new PIXI.Sprite(PIXI.Texture.fromFrame("assets/avenger.png"));
			// 		state.stage.addChild(box);
			// 		box.i = i;
			// 		box.anchor.x = box.anchor.y = 0.5;
			// 		box.scale.x = s / METER;
			// 		box.scale.y = s / METER;

			// 		state.actors[state.actors.length] = box;
			// 	}
			// }
			this.addShip({pos: {x: STAGE_WIDTH/2/METER, y: STAGE_HEIGHT/2/METER}});

			this.update();
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
			definitions.circleFixture.shape.SetRadius(size / 2 / METER);
			body.CreateFixture(definitions.circleFixture);

			var ship_actor = new PIXI.Sprite(PIXI.Texture.fromFrame("assets/avenger.png"));
			state.stage.addChild(ship_actor);
			// ship_actor.i = i;
			ship_actor.anchor.x = ship_actor.anchor.y = 0.5;
			ship_actor.scale.x = size / METER;
			ship_actor.scale.y = size / METER;

			state.actors.push(ship_actor);
			state.bodies.push(body);
		},
		update: function () {
			requestAnimationFrame(this.update.bind(this));
			state.world.Step(1 / 60,  3,  3);
			state.world.ClearForces();

			const n = state.actors.length;
			for (var i = 0; i < n; i++) {
				var body  = state.bodies[i];
				var actor = state.actors[i];
				var position = body.GetPosition();
				actor.position.x = position.x * METER;
				actor.position.y = position.y * METER;
				actor.rotation = body.GetAngle();
			}
			state.renderer.render(state.stage);
		},
		sync: function(data) {
			if (!data) {
				return;
			}
			var n = data.length;
			for (var i = 0; i < n; i++) {
				var body = state.bodies[i],
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