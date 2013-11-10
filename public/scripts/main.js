"use strict";

require.config({
	waitSeconds: 500,
	paths: {
		zepto: '3rdparty/zepto.min',
		pixi: '3rdparty/pixi',
		box2d: '3rdparty/Box2D',
		audia: '3rdparty/audia-min',
		socketio: '/socket.io/socket.io'
	},
	shim: {
		zepto: {
			exports: '$'
		},
		pixi: {
			exports: 'PIXI'
		},
		box2d: {
			exports: 'Box2D'
		},
		socketio: {
			exports: 'io'
		},
		audia: {
			exports: 'audia'
		}
	}
});

require(['3rdparty/domReady!', 'game'], function(_, G) {
	// window.console = {log: function() {return true;}};
	G.init();
});