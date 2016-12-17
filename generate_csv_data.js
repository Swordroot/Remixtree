var fs = require('fs');
var underscore = require('underscore');
var youtube = require("youtube-api")

var apiconfig = JSON.parse(fs.readFileSync(__dirname + '/config/apiconfig.json', 'utf8'));
var youtube_config = {type: "key"};
youtube_config = underscore.extend(youtube_config, apiconfig.google_api)
youtube.authenticate(youtube_config);
youtube.search.list({
    part: 'id,snippet',
    type: 'video',
    relatedToVideoId: "0E00Zuayv9Q",
    maxResults: 50
}, function(err, data){
  console.log(data);

  data.items.forEach(function(item){
    console.log(item);
  })
});