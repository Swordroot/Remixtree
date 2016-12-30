var express = require('express');
var router = express.Router();
var url = require('url');
var multer = require('multer');
var upload = multer({
    dest: './uploadFiles/'
}).single('upName');

var async = require('async');
var request = require('request');

//object Storage アクセス用
var pkgcloud = require('pkgcloud-bluemix-objectstorage');
var fs = require('fs');

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

//ここからOpenstack用の設定
var openstack_config = {
    provider: 'openstack', // required
    authUrl: services['Object-Storage'][0]['credentials']['auth_url'],
    region: 'dallas',
    useServiceCatlog: true,
    useInternal: false,
    tenantId: services['Object-Storage'][0]['credentials']['projectId'],
    userId: services['Object-Storage'][0]['credentials']['userId'],
    username: services['Object-Storage'][0]['credentials']['username'], // required
    password: services['Object-Storage'][0]['credentials']['password'], // required
    "auth": {
        forceUri: services['Object-Storage'][0]['credentials']['auth_url'] + '/v3/auth/tokens',
        interfaceName: "public",
        "identity": {
            "methods": [
                "password"
            ],
            "password": {
                "user": {
                    "id": services['Object-Storage'][0]['credentials']['userId'],
                    "password": services['Object-Storage'][0]['credentials']['password']
                }
            }
        },
        "scope": {
            "project": {
                "id": services['Object-Storage'][0]['credentials']['projectId']
            }
        }
    }
}

var getTokens = function(options, callback) {
    var targetURL = services['Object-Storage'][0]['credentials']['auth_url'] + '/v3/auth/tokens';
    request({
            method: 'POST',
            uri: targetURL, // http://yourserver:8080/auth/v1.0
            headers: {
                "Content-Type": 'application/json'
            },
            json: options,
        },
        function(err, res, body) {
            var tokens = {};

            if (!err && res && res.statusCode && res.statusCode === 201) {
                tokens['token'] = res.headers['x-subject-token'];

                callback(err, res, tokens);
            } else {
                if (!err) {
                    err = new Error("request unsuccessful, statusCode: " + res.statusCode);
                }
                callback(err, res, tokens);
            }
        }
    );
};

var storageClient = pkgcloud.storage.createClient(openstack_config);
router.post('/test', function(req, res) {
    //console.log(req.file);
    upload(req, res, function(err) {
        if (err) {
            res.send("Failed to write " + req.file.destination + " with " + err);
        } else {
            var storage_option = {
                container: 'Container1', // this can be either the name or an instance of container
                remote: req.file.originalname, // name of the new file
                contentType: req.file.mimetype, // optional mime type for the file, will attempt to auto-detect based on remote name
                size: req.file.size // size of the file
            }
            var readStream = fs.createReadStream('./uploadFiles/' + req.file.filename);
            var writeStream = storageClient.upload(storage_option);
            writeStream.on('error',function(err){
                res.send(err);
            });
            writeStream.on('success',function(file){
                res.send(file);
            });
            readStream.pipe(writeStream);
            //res.send("uploaded " + req.file.originalname + " as " + req.file.filename + " Size: " + req.file.size);
        }
    });
});

router.post('/test/getToken', function(req, res) {
    getTokens(openstack_config, function(err, response, tokens) {
        res.send(response);
    })
});

router.get('/test/auth', function(req, res) {
    storageClient.auth(function(error) {
        if (error) {
            console.error("storageClient.auth() : error creating storage client: ", error);
            res.send(error);
        } else {
            // Print the identity object which contains your Keystone token.
            console.log("storageClient.auth() : created storage client: " + JSON.stringify(storageClient._identity));
            res.send(JSON.stringify(storageClient._identity))
        }

    });
});

router.get('/test/getContainers', function(req, res) {
    storageClient.getContainers(function(err, containers) {
        res.send(containers);
    });
})

module.exports = router;
