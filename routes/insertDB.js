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

router.post('/test', function(req, res) {
    var jsonArray = [{
        "key1": "value1",
        "key2": "value2"
    }, {
        "key1": "value3",
        "key2": "value4"
    }];
    db.use('testforinsert').bulk({
        docs: jsonArray
    }, function(er) {
        if (er) {
            throw er;
        }

        console.log('Inserted all documents');
        res.send('Inserted all documents');
    });
});
router.get('/test/viewall',function(req,res){
    db.use('remixtree').view('test','test_view',function(err,body){
        if(err){
            res.send(err);
        }else{
            res.send(body);
        }
    })
})

router.get('/test/viewall',function(req,res){
    db.use('remixtree').view('test','getIdStats',function(err,body){
        if(err){
            res.send(err);
        }else{
            res.send(body);
        }
    })
})

module.exports = router;
