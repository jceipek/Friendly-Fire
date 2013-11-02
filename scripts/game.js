define(['zepto', 'pixi', 'box2d', 'helpers/math'], function ($, PIXI, Box2D, MathUtil) {
  var state = {
    stage: null
  , renderer: null
  , world: null
  , bodies: [] // instances of b2Body (from Box2D)
  , actors: []
  };

  const STAGE_WIDTH = window.innerWidth, STAGE_HEIGHT = window.innerHeight;
  const METER = 100;

  var G = {
    init: function () {
      var _g = this;

      const container = document.createElement("div");
      document.body.appendChild(container);

      state.stage = new PIXI.Stage(0xDDDDDD, true);
      state.renderer = PIXI.autoDetectRenderer(STAGE_WIDTH, STAGE_HEIGHT, undefined, false);
      document.body.appendChild(state.renderer.view);

      const loader = new PIXI.AssetLoader(["assets/ball.png",
                                           "assets/box.jpg"]);
      loader.onComplete = _g.onLoadAssets.bind(_g);
      loader.load();
    }
  , onLoadAssets: function () {
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
      bodyDef.position.Set(9, STAGE_HEIGHT / METER + 1);
      world.CreateBody(bodyDef).CreateFixture(polyFixture);
      
      //left
      polyFixture.shape.SetAsBox(1, 100);
      bodyDef.position.Set(-1, 0);
      world.CreateBody(bodyDef).CreateFixture(polyFixture);
      
      //right
      bodyDef.position.Set(STAGE_WIDTH / METER + 1, 0);
      world.CreateBody(bodyDef).CreateFixture(polyFixture);
      bodyDef.type = Box2D.Dynamics.b2Body.b2_dynamicBody;
      
      for (var i = 0; i < 40; i++) {
        bodyDef.position.Set(MathUtil.rndRange(0, STAGE_WIDTH) / METER, -MathUtil.rndRange(50, 5000) / METER);
        var body = world.CreateBody(bodyDef);
        var s;
        if (Math.random() > 0.5) {
          s = MathUtil.rndRange(70, 100);
          circleFixture.shape.SetRadius(s / 2 / METER);
          body.CreateFixture(circleFixture);
          state.bodies.push(body);
          
          var ball = new PIXI.Sprite(PIXI.Texture.fromFrame("assets/ball.png"));
          state.stage.addChild(ball);
          ball.i = i;
          ball.anchor.x = ball.anchor.y = 0.5;
          ball.scale.x = ball.scale.y = s / 100;
          
          state.actors[state.actors.length] = ball;
        }
        else {
          s = MathUtil.rndRange(50, 100);
          polyFixture.shape.SetAsBox(s / 2 / METER, s / 2 / METER);
          body.CreateFixture(polyFixture);
          state.bodies.push(body);
          
          var box = new PIXI.Sprite(PIXI.Texture.fromFrame("assets/box.jpg"));
          state.stage.addChild(box);
          box.i = i;
          box.anchor.x = box.anchor.y = 0.5;
          box.scale.x = s / 100;
          box.scale.y = s / 100;
          
          state.actors[state.actors.length] = box;
        }
      }
      _g.update();
    }
  , update: function () {
      var _g = this;
      requestAnimationFrame(_g.update.bind(_g));
      world.Step(1 / 60,  3,  3);
      world.ClearForces();
        
      const n = state.actors.length;
      for (var i = 0; i < n; i++) {
          var body  = state.bodies[i];
          var actor = state.actors[i];
          var position = body.GetPosition();
          actor.position.x = position.x * 100;
          actor.position.y = position.y * 100;
          actor.rotation = body.GetAngle();
      }

      state.renderer.render(state.stage);
    }
  };

  window.G = G;
  return G;
});