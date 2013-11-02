/**
* Module dependencies.
*/

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var path = require('path');
var io = require('socket.io').listen(server);
var game = require('./friendly-fire');

game.init();

app.use(express.static(path.join(__dirname, '../public')));

server.listen(5000);

app.get('/', function (req, res) {
    res.sendfile(__dirname + '../index.html');
});

io.sockets.on('connection', function (socket) {
    socket.emit('news', { hello: 'world' });
    socket.on('my other event', function (data) {
        console.log(data);
    });
});