var express = require('express');
var router = express.Router();
var url = require('url');

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
    getTreeJSON(1, res);

});

router.get('/Test/getTreeJsonFromId', function(req, res) {
    var url_parts = url.parse(req.url, true);
    var id = url_parts.query.treeId;
    //res.send(url_parts.query);
    getTreeJsonFromId(id,res);
});

var dbSearch = db.use("remixtree").search;

var getTreeJsonFromId = function(id, res) {
    dbSearch('test', 'searchByTreeGroup', {
        q: 'id:"' + id + '"'
    }, function(er, result) {
        res.send(result.rows);
        //var treeGroup = result.rows[0].fields.tree_group;
        //getTreeJSON(treeGroup,res);
    })
}

var getTreeJSON = function(tree_group, res) {
    var sendingValue = [];
    var finishedFlag = false;
    //callback Root

    //親子関係だけでツリーを作成するのは、非同期で検索結果が来る以上無理なので
    //ツリーグループというカラムを一つ追加し、ツリーのIDを持たせることとする。
    //これにより、あるツリーに属するデータを全取得、そのデータをもとに親子関係を作る
    //ということが可能になる
    dbSearch('test', 'searchByTreeGroup', {
        q: 'tree_group:' + tree_group + ''
    }, function(er, result) {
        if (er) {
            throw er;
        }

        res.send(makeTreeData(result.rows));
    });

}

var makeTreeData = function(dataArray) {
    var rootElement = dataArray.filter(function(item, index) {
        if (item.fields.parent_id == 0) {
            return true;
        }
    });
    rootElement[0].children = makeTreeDataChildren(dataArray, rootElement[0].id);
    return rootElement[0];
}
var makeTreeDataChildren = function(dataArray, parent_id) {
    var returnArray = dataArray.filter(function(item, index) {
        if (item.fields.parent_id == parent_id) {
            return true;
        }
    });

    for (var i = 0; i < returnArray.length; i++) {
        returnArray[i].children = makeTreeDataChildren(dataArray, returnArray[i].id);
    }
    return returnArray;
}

module.exports = router;
