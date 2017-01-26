var express = require('express');
var app = express();
//var port = process.env.PORT || 3000;

var fs = require( 'fs' );
var ejs = require( 'ejs' );
app.engine('ejs',ejs.renderFile);
　
//サーバーの立ち上げ
var http = require('http');

var cfenv = require( 'cfenv' );
var appEnv = cfenv.getAppEnv();

app.use(express.static(__dirname + '/public'));

//body-parser
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


//指定したポートにきたリクエストを受け取れるようにする
var server = http.createServer(app).listen(appEnv.port, function () {
  console.log('Server listening at port %d', appEnv.port);
});

app.get('/', function(req, res){
  var template = fs.readFileSync(__dirname + '/public/index.ejs', 'utf-8');
  var data = ejs.render(template, {});

  res.writeHead(200, { 'Content-Type': 'text/html' } );
  res.write(data);
  res.end();
});

app.get('/tree', function(req, res){
  var template = fs.readFileSync(__dirname + '/public/tree/index.ejs', 'utf-8');
  var data = ejs.render(template, {});

  res.writeHead( 200, { 'Content-Type': 'text/html' } );
  res.write(data);
  res.end();
});


app.use('/getTreeData', require('./routes/getTreeData'));


app.use('/insertDB', require('./routes/insertDB'));




//app.use('/upload',require('./routes/upload.js'))

app.get('/tree/play', function(req, res){
  var template = fs.readFileSync(__dirname + '/public/tree/play.ejs', 'utf-8');
  var data = ejs.render(template, {});

  res.writeHead( 200, { 'Content-Type': 'text/html' } );
  res.write(data);
  res.end();
});

app.listen(server);
