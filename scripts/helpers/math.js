/**
 * @author julian.ceipek@gmail.com
 * ported from code by kozakluke@gmail.com
 */
define([], function () {
  var G = {
    rndRange: function (min, max) {
      return min + (Math.random() * (max - min));
    }
  , rndIntRange: function (min, max) {
      return Math.round(rndRange(min, max));
    }
  , toRadians: function (degrees) {
      return degrees * RADIANS;
    }
  , toDegrees: function (radians) {
      return radians * DEGREES;
    }
  , hitTest: function (x1, y1, w1, h1, x2, y2, w2, h2) {
      if (x1 + w1 > x2)
        if (x1 < x2 + w2)
          if (y1 + h1 > y2)
            if (y1 < y2 + h2)
              return true;

      return false;
    }
  };

  return G;
});