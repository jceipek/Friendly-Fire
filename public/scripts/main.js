"use strict";

require.config({
  paths: {
    zepto: '3rdparty/zepto.min'
  , pixi: '3rdparty/pixi'
  , box2d: '3rdparty/Box2D'
  },
  shim: {
    zepto: {
      exports: '$'
    }
    , pixi: {
      exports: 'PIXI'
    }
    , box2d: {
      exports: 'Box2D'
    }
  }
});

require(['3rdparty/domReady!', 'game'], function(_, G) {
  window.console = {log: function() {return true;}};
  G.init();
});