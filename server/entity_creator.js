var Box2D = require('box2dweb');

var definitions = {
  polyFixture: new Box2D.Dynamics.b2FixtureDef(),
  circleFixture: new Box2D.Dynamics.b2FixtureDef(),
  bodyDef: new Box2D.Dynamics.b2BodyDef()
};

var state;
var object_tracker = 0; // Increments every time a new object is added

const PX_PER_METER = 100; // conversion

var creator = {
  initWithState: function (s) {
    state = s;
    this.initFixtures();
  },
  initFixtures: function () {
    definitions.circleFixture.shape = new Box2D.Collision.Shapes.b2CircleShape();
    definitions.circleFixture.density = 1;
    definitions.circleFixture.restitution = 0.7;
  },
  addBullet: function (params) {
    var _g = this;
    params = params || {};
    var pos = params.pos || {x: 0, y: 0},
        angle = params.angle || 0,
        ship_vel = params.ship_vel || {x: 0, y: 0},
        bullet_speed = params.bullet_speed || 5,
        body,
        size;
    var vec = new Box2D.Common.Math.b2Vec2(Math.sin(angle), -Math.cos(angle));
    var vel = new Box2D.Common.Math.b2Vec2(vec.x * bullet_speed + ship_vel.x, vec.y * bullet_speed + ship_vel.y);

    definitions.bodyDef.type = Box2D.Dynamics.b2Body.b2_dynamicBody;
    definitions.bodyDef.position.Set(pos.x + vec.x * 0.3, pos.y + vec.y * 0.3);
    body = state.world.CreateBody(definitions.bodyDef);

    size = 5;
    definitions.circleFixture.shape.SetRadius(size / 2 / PX_PER_METER);
    body.CreateFixture(definitions.circleFixture);
    body.SetAngle(angle);
    body.SetLinearVelocity(vel);
    var id = object_tracker;
    state.bodies[id] = body;
    state.bodies[id].SetUserData({id: id, entity_type: 'bullet'});
    object_tracker++;
    return id;
  },
  addShip: function (params) {
    params = params || {};
    var pos = params.pos || {x: 0, y: 0},
      type = params.type || 'avenger',
      body,
      size;

    definitions.bodyDef.type = Box2D.Dynamics.b2Body.b2_dynamicBody;
    definitions.bodyDef.position.Set(pos.x, pos.y);
    body = state.world.CreateBody(definitions.bodyDef);

    size = 50;
    definitions.circleFixture.shape.SetRadius(size / 2 / PX_PER_METER);
    body.CreateFixture(definitions.circleFixture);

    var id = object_tracker;
    state.bodies[id] = body;
    state.bodies[id].SetUserData({id: id, entity_type: type});
    object_tracker++;
    return id;
  },
  _removeObject: function (id) {
    state.world.DestroyBody(state.bodies[id]);
    delete state.bodies[id];
  },
}

module.exports = creator;