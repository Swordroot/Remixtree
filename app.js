var express = require('express');
var app = express();
//var port = process.env.PORT || 3000;

var fs = require( 'fs' );
var ejs = require( 'ejs' );

//サーバーの立ち上げ
var http = require('http');

var cfenv = require( 'cfenv' );
var appEnv = cfenv.getAppEnv();

app.use(express.static(__dirname + '/public'));

// Cloudant用アクセス・モジュール「cradle」設定
var cradle = require('cradle');

// Cloudant DB接続情報取得
var services = JSON.parse(process.env.VCAP_SERVICES);
console.log(JSON.stringify(services));

var credentials = services['cloudantNoSQLDB'][0].credentials;
var host = credentials.host;
var port = credentials.port;
var options = {
 cache : true,
 raw : false,
 secure : true,
 auth : {
 username : credentials.username,
 password : credentials.password
 }
};

// データベース接続
var db = new (cradle.Connection)(host, port, options).database('cldb');

//指定したポートにきたリクエストを受け取れるようにする
var server = http.createServer(app).listen(appEnv.port, function () {
  console.log('Server listening at port %d', port);
});

app.get('/tree', function(req, res){
  var template = fs.readFileSync(__dirname + '/public/tree/index.ejs', 'utf-8');
  var data = ejs.render(template, {});
  
  res.writeHead( 200, { 'Content-Type': 'text/html' } );
  res.write(data);
  res.end();
});

app.post('/save', function(req, res){
 var date = new Date();
 var now = date.toString();
 console.log(req);
 req.body.date = now;

 // 項目の保存
 db.save(now, req.body);
  res.send(req.body);
});
//「全件削除」ボタンの id=removeAll, ui_item.jsの url:'/removeAll'でcall
app.post('/removeAll', function(req, res){

 // 全件検索を、作成したview名 items_view にて実行
 db.view('items/items_view', function (err, rows) {
 if (!err) {
 rows.forEach(function (id, row) {
 db.remove(id);
 console.log("removed key is: %s", id);
 });
 } else { console.log("app.js db.remove error: " + err); }

 });

 res.send({});
});


//「全件表示」ボタンの id=getAll, ui_item.jsの url:'/getAll'でcall
app.post('/getAll', function(req, res){
 returnTable(res);
});

var returnTable = function(res) {
 // 全件検索を、作成したview名 items_view にて実行
 db.view('items/items_view', function (err, rows) {
 if (!err) {
 rows.forEach(function (id, row) {
 console.log("key: %s, row: %s", id, JSON.stringify(row));
 });
 } else { console.log("app.js returnTable error: " + err); }

 res.send(rows);
 });
}
app.listen(server);