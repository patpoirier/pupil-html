'use strict';

var util = require('util');
var app = require('express')();
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var jwt = require('jsonwebtoken');
var io = require('socket.io')(http);
var socketioJwt = require('socketio-jwt');
var users = require('./users');

let AUTH_SECRET = 'erudite-rocks';

var contacts = Object.keys(users).map((username) => {
  return {
    username: username,
    roles: users[username].roles,
    isOnline: false
  }
})

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/login', (req, res) => {
  if (!users.hasOwnProperty(req.body.username)) return res.status(401).json({
    error: 'unauthorized',
    message: 'User not found'
  });

  var user = users[req.body.username];

  if (req.body.passphrase !== user.passphrase) return res.status(401).json({
    error: 'unauthorized',
    message: 'Incorrect passphrase'
  })


  var token = jwt.sign({
    username: req.body.username,
    roles: user.roles
  }, AUTH_SECRET);

  res.cookie('access_token', token);

  return res.json({
    ok: true,
    username: req.body.username,
    token: token
  });
})

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/messenger.html');
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});



io.use(socketioJwt.authorize({
  secret: AUTH_SECRET,
  handshake: true
}));
///////////////////////////////

io.on('connection', function (socket) {
  var username = socket.decoded_token.username;
  util.log(`${username} signed on`);

  // mark the user as online
  for (var i = 0; i < contacts.length; i++){
    var contact = contacts[i];
    if (contact.username == username) contact.isOnline = true;
  }

  io.emit('contacts', contacts);

  socket.on('disconnect', () => {
    contacts = contacts.map((contact) => {
      if (contact.username != username) return contact;
      contact.isOnline = false;
      return contact;
    })

    io.emit('contacts', contacts);
    util.log(`${username} signed off`);
  })
})
