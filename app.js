var express = require('express');
var app = express();
var port = process.env.PORT || 3000;

var fs = require( 'fs' );
var ejs = require( 'ejs' );

//サーバーの立ち上げ
var http = require('http');

var cfenv = require( 'cfenv' );
var appEnv = cfenv.getAppEnv();

port = appEnv.port;

app.use(express.static(__dirname + '/public'));

//指定したポートにきたリクエストを受け取れるようにする
var server = http.createServer(app).listen(port, function () {
  console.log('Server listening at port %d', port);
});

app.get('/tree', function(req, res){
  var template = fs.readFileSync(__dirname + '/public/tree/index.ejs', 'utf-8');
  var data = ejs.render(template, {});
  
  res.writeHead( 200, { 'Content-Type': 'text/html' } );
  res.write(data);
  res.end();
});

app.get('/tree/play', function(req, res){
  var template = fs.readFileSync(__dirname + '/public/tree/play.ejs', 'utf-8');
  var data = ejs.render(template, {});
  
  res.writeHead( 200, { 'Content-Type': 'text/html' } );
  res.write(data);
  res.end();
});
app.listen(server);