var express = require('express');
var app = express();
var port = process.env.PORT || 3000;

//サーバーの立ち上げ
var http = require('http');

//指定したポートにきたリクエストを受け取れるようにする
var server = http.createServer(app).listen(port, function () {
  console.log('Server listening at port %d', port);
});


app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html');
});