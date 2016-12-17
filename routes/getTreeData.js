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
	res.send(getTreeJSON(0));
	
});

var getTreeJSON = function(parent_id) {
	
	db.use("remixtree").search('test', 'test_search', {
		q: 'parent_id:"' + parent_id + '"' 
	}, function(er, result) {
		var returnValue = [];
		if (er) {
			throw er;
		}

		for(var i=0;i<result.rows.length;i++){
			returnValue.push({"id":result.rows[i].id,"children":getTreeJSON(result.rows[i].id)});
		}
		return returnValue;
	});
}

module.exports = router;