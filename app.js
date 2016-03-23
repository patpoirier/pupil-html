var app = require('express')();
var http = require('http').Server(app);
var bodyParser = require('body-parser');
var jwt = require('jsonwebtoken');
var io = require('socket.io')(http);
var users = require('./users');

var onlineUsers = {};

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
  }, 'erudite-rocks');

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

io.on('connection', function(socket){
  console.log('connected');
  socket.on('status', function(status){
    // verify the token
    try {
      var decodedToken = jwt.verify(status.token, 'erudite-rocks');
    } catch (e){
      return socket.emit('unauthorized');
    }

    if (status.status == 'online'){
      onlineUsers[decodedToken.username] = socket.id;

      Object.keys(onlineUsers).filter((username) => {
        return username !== decodedToken.username;
      }).forEach((username) => {
        io.emit('status', {
          user: username,
          status: 'online'
        })
      })
    }

    console.log('decoded:', decodedToken, 'status:', status.status, onlineUsers);
  })

  socket.on('message', function(message){
    io.emit('message', message);
  })

  socket.on('disconnect', function(){
    var disconnectedUser;

    onlineUsers = Object.keys(onlineUsers).filter((username) => {
      // remove the user who is not online anymore
      var socketId = onlineUsers[username];
      if (socket.id == socketId) disconnectedUser = {
        username: username
      }

      return socketId != socket.id;
    }).reduce((previousValue, currentValue, currentIndex, array) => {
      console.log('reduce', previousValue, currentIndex, currentIndex, array);
      var username = array[currentIndex];
      previousValue[username] = onlineUsers[username];
      return previousValue;
    }, {});

    io.emit('status', {
      status: 'offline',
      username: disconnectedUser.username
    });
  })
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
