var express = require('express');
var router = express.Router();

// Cloudant用アクセス・モジュール「cradle」設定
var cradle = require('cradle');

// Cloudant DB接続情報取得
var services = JSON.parse(process.env.VCAP_SERVICES);

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
var db = new (cradle.Connection)(host, port, options).database('remixtree');

 router.post('/Test', function(req, res){
 //res.setHeader('Content-Type', 'text/plain');
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

module.exports = router;