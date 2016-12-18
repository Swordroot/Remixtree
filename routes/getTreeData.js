var express = require('express');
var router = express.Router();

// Cloudant用アクセス・モジュール「cradle」設定
var Cloudant = require('cloudant');

// Cloudant DB接続情報取得
var services = {};

if (typeof process.env.VCAP_SERVICES === 'undefined') {
    services = require('../config/VCAP_SERVICES.json');
} else {
    services = JSON.parse(process.env.VCAP_SERVICES)
};

var credentials = services['cloudantNoSQLDB'][0].credentials;
var host = credentials.host;
var port = credentials.port;
var options = {
    cache: true,
    raw: false,
    secure: true,
    auth: {
        username: credentials.username,
        password: credentials.password
    }
};

// データベース接続
var cloudant = Cloudant({
    account: credentials.username,
    password: credentials.password
});
var db = cloudant.db;

router.post('/Test', function(req, res) {
    //res.setHeader('Content-Type', 'text/plain');
    getTreeJSON(0, res);

});

var dbSearch = db.use("remixtree").search;

var getTreeJSON = function(parent_id, res) {
    var sendingValue = [];
    var finishedFlag = false;
    //callback Root

    //親子関係だけでツリーを作成するのは、非同期で検索結果が来る以上無理なので
    //ツリーグループというカラムを一つ追加し、ツリーのIDを持たせることとする。
    //これにより、あるツリーに属するデータを全取得、そのデータをもとに親子関係を作る
    //ということが可能になる
    var aaa = dbSearch('test', 'test_search', {
        q: 'parent_id:"' + parent_id + '"'
    }, function(){});
    res.send(aaa);
}

module.exports = router;
