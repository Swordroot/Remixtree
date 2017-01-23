var express = require('express');
var router = express.Router();
var url = require('url');
var multer = require('multer');
var upload = multer({
    dest: './uploadFiles/'
}).single('upName');

var ytdl = require('youtube-dl');
var ytapi = require('youtube-api');
var opn = require('opn');
var oauth = {};
var uploadFilenameOnThisServer = "";

var async = require('async');
var request = require('request');

//object Storage アクセス用
var pkgcloud = require('pkgcloud-bluemix-objectstorage');
var fs = require('fs');
var mime = require('mime');

// Cloudant用アクセス・モジュール「cradle」設定
var Cloudant = require('cloudant');

// Cloudant DB接続情報取得
var services = {};
var google_api_key = "";
var client_credencials = {};
var http_protocol = ""; //
var http_host = "";

var cfenv = require('cfenv');
var appEnv = cfenv.getAppEnv();
var http_port = "";
var redirectURLForGoogleOAuth;
if (typeof process.env.VCAP_SERVICES === 'undefined') {
    services = require('../config/VCAP_SERVICES.json');
    google_api_key = require('../config/apiconfig.json').tone_api.key;
    client_credencials = require('../config/client_secret_tone.json');
    http_protocol = "http://";
    http_host = "localhost"
    http_port = ":" + appEnv.port;
    redirectURLForGoogleOAuth = client_credencials.web.redirect_uris[0];
} else {
    services = JSON.parse(process.env.VCAP_SERVICES);
    google_api_key = process.env.tone_api_key;
    client_credencials = JSON.parse(process.env.client_secret_tone);
    http_protocol = "https://";
    http_host = "remixtreehackasong.mybluemix.net"
    redirectURLForGoogleOAuth = client_credencials.web.redirect_uris[1];
};

oauth = ytapi.authenticate({
    type: "oauth",
    client_id: client_credencials.web.client_id,
    client_secret: client_credencials.web.cilent_secret,
    redirect_url: redirectURLForGoogleOAuth
});
opn(oauth.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"]
}));

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
var uploadToFileServerCallback = function(req, res) {
    storageClient.auth(function(error) {
        if (error) {
            console.error("storageClient.auth() : error creating storage client: ", error);
            res.send(error);
        } else {
            // Print the identity object which contains your Keystone token.
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
                    writeStream.on('error', function(err) {
                        res.send(err);
                    });
                    writeStream.on('success', function(file) {
                        fs.unlink('./uploadFiles/' + req.file.filename, function(err) {
                            if (err) {
                                res.send(err);
                            } else {
                                res.send(file);
                            }
                        })

                    });
                    readStream.pipe(writeStream);
                    //res.send("uploaded " + req.file.originalname + " as " + req.file.filename + " Size: " + req.file.size);
                }
            });
        }

    });
};

var uploadToFileServerFromYoutubeCallback = function(req, res) {
    var ytURL = req.body.youtubeURL;
    var video = ytdl(ytURL);
    storageClient.auth(function(error) {
        if (error) {
            res.send(error);
        } else {
            var info_;
            video.on('info', function(info) {
                info_ = info;
                console.log(info);
            });
            video.pipe(fs.createWriteStream('./uploadFiles/' + '____buffer____'));
            video.on('end', function() {
                var storage_option = {
                    container: 'Container1', // this can be either the name or an instance of container
                    remote: info_._filename, // name of the new file
                    contentType: mime.lookup('./uploadFiles/' + '____buffer____'), // optional mime type for the file, will attempt to auto-detect based on remote name
                    size: info_.size // size of the file
                }
                var readStream = fs.createReadStream('./uploadFiles/' + '____buffer____');
                var writeStream = storageClient.upload(storage_option);
                writeStream.on('error', function(err) {
                    res.send(err);
                });
                writeStream.on('success', function(file) {
                    fs.unlink('./uploadFiles/' + '____buffer____', function(err) {
                        if (err) {
                            res.send(err);
                        } else {
                            res.send(file);
                        }
                    })

                });
                readStream.pipe(writeStream);

            })
        }
    });
};
router.post('/test', uploadToFileServerCallback);

router.post('/uploadByYoutubeURL', uploadToFileServerFromYoutubeCallback);

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
    storageClient.auth(function(error) {
        if (error) {
            console.error("storageClient.auth() : error creating storage client: ", error);
            res.send(error);
        } else {
            // Print the identity object which contains your Keystone token.
            console.log("storageClient.auth() : created storage client: " + JSON.stringify(storageClient._identity));
            storageClient.getContainers(function(err, containers) {
                res.send(containers);
            });
        }

    });

});
router.get('/test/getFile', function(req, res) {
    storageClient.auth(function(error) {
        if (error) {
            //console.error("storageClient.auth() : error creating storage client: ", error);
            res.send(error);
        } else {
            // Print the identity object which contains your Keystone token.
            //console.log("storageClient.auth() : created storage client: " + JSON.stringify(storageClient._identity));
            var url_parts = url.parse(req.url, true);
            url_parts.query.filename
            storageClient.download({
                container: 'Container1',
                remote: url_parts.query.filename,
                local: './downloadFiles/' + url_parts.query.filename
            }, function(err, result) {
                // handle the download result
                if (err) {
                    res.send(err);
                } else {
                    fs.readFile('./downloadFiles/' + url_parts.query.filename, function(err, data) {
                        res.header({
                            'Content-Type': mime.lookup('./downloadFiles/' + url_parts.query.filename)
                        });
                        fs.unlink('./downloadFiles/' + url_parts.query.filename, function(err) {
                            if (err) {
                                res.send(err);
                            } else {
                                res.send(data);
                            }
                        });
                    })

                }
            });
        }

    });

});
router.get('/youtubeAuth',function(req,res){
    oauth = ytapi.authenticate({
        type: "oauth",
        client_id: client_credencials.web.client_id,
        client_secret: client_credencials.web.cilent_secret,
        redirect_url: redirectURLForGoogleOAuth
    });
    opn(oauth.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/youtube.upload"]
    }));

})
router.get('/notifyProcessingComplete', function(req, res) {
    storageClient.auth(function(error) {
        if (error) {
            //console.error("storageClient.auth() : error creating storage client: ", error);
            res.send(error);
        } else {
            // Print the identity object which contains your Keystone token.
            //console.log("storageClient.auth() : created storage client: " + JSON.stringify(storageClient._identity));
            var url_parts = url.parse(req.url, true);
            url_parts.query.filename
            storageClient.download({
                container: 'Container1',
                remote: url_parts.query.filename,
                local: './downloadFiles/' + url_parts.query.filename
            }, function(err, result) {
                // handle the download result
                if (err) {
                    res.send(err);
                } else {
                    //ここからyoutubeにアップロードする処理を組んでいく
                    uploadFilenameOnThisServer = url_parts.query.filename;
                    var uploadrequest = ytapi.videos.insert({
                        resource: {
                            // Video title and description
                            snippet: {
                                title: "Testing YoutTube API NodeJS module",
                                description: "Test video upload via YouTube API"
                            }
                            // I don't want to spam my subscribers
                            ,
                            status: {
                                privacyStatus: "private"
                            }
                        }
                        // This is for the callback function
                        ,
                        part: "snippet,status"

                        // Create the readable stream to upload the video
                        ,
                        media: {
                            body: fs.createReadStream('./downloadFiles/' + url_parts.query.filename)
                        }
                    }, (err, data) => {
                        if(err){
                            res.send(err);
                        }else{
                            console.log("Done.");
                            console.log(data);
                            res.send(data);
                        }
                    });


                    //---------------------------------------------
                    // fs.readFile('./downloadFiles/' + url_parts.query.filename, function(err, data) {
                    //     res.header({
                    //         'Content-Type': mime.lookup('./downloadFiles/' + url_parts.query.filename)
                    //     });
                    //     fs.unlink('./downloadFiles/' + url_parts.query.filename, function(err) {
                    //         if (err) {
                    //             res.send(err);
                    //         } else {
                    //             res.send(data);
                    //         }
                    //     });
                    // })

                }
            });
        }

    });
});
router.get('/afterOAuth', function(req, res) {
    var url_parts = url.parse(req.url, true);

    var bodyobj = {
        "code": url_parts.query.code,
        "client_id": client_credencials.web.client_id,
        "client_secret": client_credencials.web.client_secret,
        "redirect_uri": redirectURLForGoogleOAuth,
        "grant_type": 'authorization_code'
    };
    console.log(bodyobj)


    request.post({
        uri: client_credencials.web.token_uri,
        form: bodyobj
    }, function(error, httpResponse, body) {
        if (error) {
                console.log(error);
                res.send(error);
            } else {
                console.log("Got the tokens.");

                oauth.setCredentials(JSON.parse(body));
                res.send(body);
            }
     })

});


/*
入力欄に必要なもの

・タイトル
・動画ファイル
・タグ指定
・ジャンル

入力はさせないけど必要なパラメータ
・親ID(fromクエリパラメータ)
*/
router.get('/Form', function(req, res) {
    var url_parts = url.parse(req.url, true);
    var renderObject = {};
    if (!url_parts.query.parentId) {
        res.send("specify parentId in query parameter");
    } else {
        renderObject.parentId = url_parts.query.parentId;
        console.log(req.secure);
        var req_protocol = '';
        if (!req.secure) {
            req_protocol = 'http://'
        } else {
            req_protocol = 'https://'
        }
        request(req_protocol + req.headers.host + '/getTreeData/getTreeJsonFromId?treeId=' + url_parts.query.parentId, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(JSON.parse(body)[0]);
                renderObject.baseYoutubeUrl = JSON.parse(body)[0].youtubeUrl;
                renderObject.tree_group = JSON.parse(body)[0].tree_group;
                res.render('uploadForm.ejs', renderObject);
            } else {
                res.send(error);
            }
        });
    }


});
router.post('/FromUpLoadForm', function(req, res) {
    var sendingObject = {};
    storageClient.auth(function(error) {
        if (error) {
            console.error("storageClient.auth() : error creating storage client: ", error);
            res.send(error);
        } else {
            // Print the identity object which contains your Keystone token.
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
                    writeStream.on('error', function(err) {
                        res.send(err);
                    });
                    writeStream.on('success', function(file) {
                        fs.unlink('./uploadFiles/' + req.file.filename, function(err) {
                            if (err) {
                                res.send(err);
                            } else {
                                //ここで元動画のアップロード完了
                                sendingObject.userMovieFile = file;
                                //コールバック地獄だけど気にしたら負け
                                //コールバック地獄にならないいい書き方誰か教えて
                                //ここから編集元youtube動画のアップロード
                                var ytURL = req.body.youtubeURL;
                                var video = ytdl(ytURL);
                                var info_;
                                video.on('info', function(info) {
                                    info_ = info;
                                    console.log(info);
                                });
                                video.pipe(fs.createWriteStream('./uploadFiles/' + '____buffer____'));
                                video.on('end', function() {
                                    var storage_option = {
                                        container: 'Container1', // this can be either the name or an instance of container
                                        remote: info_._filename, // name of the new file
                                        contentType: mime.lookup('./uploadFiles/' + '____buffer____'), // optional mime type for the file, will attempt to auto-detect based on remote name
                                        size: info_.size // size of the file
                                    }
                                    var readStream = fs.createReadStream('./uploadFiles/' + '____buffer____');
                                    var writeStream = storageClient.upload(storage_option);
                                    writeStream.on('error', function(err) {
                                        res.send(err);
                                    });
                                    writeStream.on('success', function(file2) {
                                        fs.unlink('./uploadFiles/' + '____buffer____', function(err) {
                                            if (err) {
                                                res.send(err);
                                            } else {
                                                sendingObject.baseYoutubeMovieFile = file2;
                                                //ここでyoutube動画もアップロード完了
                                                //メタデータをDBに挿入するところに入る
                                                var req_protocol = '';
                                                if (!req.secure) {
                                                    req_protocol = 'http://'
                                                } else {
                                                    req_protocol = 'https://'
                                                }
                                                request(req_protocol + req.headers.host + '/insertDB/test/viewStats', function(error, response, body) {
                                                    if (!error && response.statusCode == 200) {
                                                        var newMetaData = {};
                                                        newMetaData.id = JSON.parse(body).rows[0].value.max + 1;
                                                        newMetaData.parentId = req.body.parentId;
                                                        newMetaData.childrenIds = [];
                                                        newMetaData.title = req.body.title;
                                                        console.log(req.body.tags);
                                                        newMetaData.tags = JSON.stringify(info_.tags.concat(req.body.tags));
                                                        newMetaData.genre = req.body.genre;
                                                        newMetaData.tree_group = req.body.tree_group;
                                                        request.post({
                                                            url: req_protocol + req.headers.host + '/insertDB/insertNewData',
                                                            form: newMetaData
                                                        }, function(error, response, body) {
                                                            if (!error && response.statusCode == 200) {
                                                                //ここから編集サーバーに通知を送信
                                                                res.send(sendingObject);
                                                            } else {
                                                                res.send(error);
                                                            }
                                                        })
                                                    } else {
                                                        res.send(error);
                                                    }
                                                });
                                                //res.send(sendingObject);
                                            }
                                        })

                                    });
                                    readStream.pipe(writeStream);

                                })
                            }
                        })

                    });
                    readStream.pipe(writeStream);
                    //res.send("uploaded " + req.file.originalname + " as " + req.file.filename + " Size: " + req.file.size);
                }
            });
        }

    });
});
module.exports = router;
