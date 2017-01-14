var fs = require('fs');
var underscore = require('underscore');
var youtube = require("youtube-api")
var youtubedl = require('youtube-dl');

var apiconfig = JSON.parse(fs.readFileSync(__dirname + '/../config/apiconfig.json', 'utf8'));
var youtube_config = {type: "key"};
youtube_config = underscore.extend(youtube_config, apiconfig.google_api)
youtube.authenticate(youtube_config);

exports.upload = function() {
};

exports.getVideoInfos = function(videoIds, callback){
  var videoIdList = Array.prototype.concat.apply([], [videoIds]);
  youtube.videos.list({
    part: 'id,snippet',
    type: 'video',
    id: videoIdList.join(","),
    maxResults: 50
  }, function(err, data){
    console.log(data);
    callback(data);
  });
}

exports.donwload = function(videoIds, callback){
  var videoIdList = Array.prototype.concat.apply([], [videoIds]);
  videoIdList.forEach(function(videoId){
    var video = youtubedl('http://www.youtube.com/watch?v=' + videoId);
    video.on('info', function(info) {
      console.log('filename: ' + info._filename);
    });
    video.on('complete', function complete(info) {
      console.log('filename: ' + info._filename + ' already downloaded.');
      callback(info._filename);
    });
    video.pipe(fs.createWriteStream('myvideo.mp4'));
  });
}