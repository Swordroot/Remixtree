var fs = require('fs');
var Converter = require('csvtojson').Converter;
var converter = new Converter({});

// Cloudant用アクセス・モジュール「cradle」設定
var Cloudant = require('cloudant');

// Cloudant DB接続情報取得
var services = {};

if (typeof process.env.VCAP_SERVICES === 'undefined') {
    services = require('./config/VCAP_SERVICES.json');
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

converter.on("end_parsed", function(jsonArray) {
    var groupCount = 1;
    var arr = jsonArray.filter(function(elem, index, array) {
        if (elem.parentId == 0) {
            array[index].tree_group = groupCount;
            groupCount++;
        }
        return elem.parentId == 0;
    })
    for (var i = 0; i < arr.length; i++) {
        setTreeGroup(arr[i].id, jsonArray, arr[i].tree_group);
    }
    db.use('remixtree').bulk({
        docs: jsonArray
    }, function(er) {
        if (er) {
            throw er;
        }

        console.log('Inserted all documents');
    });

    fs.writeFile('./files/sample.json', JSON.stringify(jsonArray, null, '    '));


});

var setTreeGroup = function(id, rowArray, groupId) {
    var targetElement = rowArray.filter(function(elem, index, array) {
        if (elem.id == id) {
            array[index].tree_group = groupId;
            for (var i = 0; i < array[index].childrenIds.length; i++) {
                setTreeGroup(array[index].childrenIds[i], array, groupId);
            }
        }
        return true;
    });
}

require("fs").createReadStream("./files/tree_master.csv").pipe(converter);
