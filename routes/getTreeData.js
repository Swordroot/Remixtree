var express = require('express');
var router = express.Router();

// Cloudant用アクセス・モジュール「cradle」設定
var Cloudant = require('cloudant');

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
var cloudant = Cloudant({account:credentials.username,password:credentials.password});
var db = cloudant.db;

router.post('/Test', function(req, res){
 //res.setHeader('Content-Type', 'text/plain');
 //returnTable(res);
 db.list(function(err,allDBs){
 	res.send(allDBs.join(","));
 });
});

var returnTable = function(res) {
 // 全件検索を、作成したview名 items_view にて実行
 db.view('test/test_view', function (err, rows) {
 res.send(rows);
 });
}

module.exports = router;