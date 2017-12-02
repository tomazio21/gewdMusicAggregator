'use strict';

const querystring = require('querystring');
const request = require('request-promise');
const express = require('express');
const bodyParser = require('body-parser');
const WebSocketFaye = require('faye-websocket')
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const app = express();
var groupMeSocket;
var db;
var config;

init();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'client/build')));

app.get('/byDate', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY date_posted DESC';
    querySongData(sqlStmt, res);
})
app.get('/byDateRev', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY date_posted';
    querySongData(sqlStmt, res);
})
app.get('/bySong', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY name';
    querySongData(sqlStmt, res);
})
app.get('/bySongRev', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY name DESC';
    querySongData(sqlStmt, res);
})
app.get('/byArtist', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY artist';
    querySongData(sqlStmt, res);
})
app.get('/byArtistRev', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY artist DESC';
    querySongData(sqlStmt, res);
})
app.get('/byUser', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY user DESC';
    querySongData(sqlStmt, res);
})
app.get('/byUserRev', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY user';
    querySongData(sqlStmt, res);
})
app.get('/byReactions', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY reactions';
    querySongData(sqlStmt, res);
})
app.get('/byReactionsRev', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY reactions DESC';
    querySongData(sqlStmt, res);
})
app.get('/byAlbum', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY album';
    querySongData(sqlStmt, res);
})
app.get('/byAlbumRev', (req, res) => {
    let sqlStmt = 'SELECT name, artist, album, link, user, reactions, date_posted FROM songs ORDER BY album DESC';
    querySongData(sqlStmt, res);
})
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname+'/client/build/index.html'));
})

app.listen(3000, () => console.log('Listening on port 3000'));

function init() {
    let configFile = fs.readFileSync("config.json");
    config = JSON.parse(configFile);
    openWebsocketforGroupMe();
    initDB();
}

// ---network functions

function getAccessToken() {
    const client_id = config.spotify_client_id;
    const client_secret = config.spotify_client_secret;
    let options = {
        method : 'POST',
        uri: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
        },
        form: {
            grant_type: 'client_credentials'
        },
        json: true
    };

    return new Promise((resolve, reject) => {
        request(options)
            .then(function (body) {
                resolve(body.access_token);
            })
            .catch(function (error) {
                reject(new Error(error));
            });
    });
}

async function openWebsocketforGroupMe() {
    try {
        let url = 'wss://push.groupme.com/faye';
        let userId = await getMyGroupMeUserId();
        let clientId = await groupMeHandshakeRequest();
        let success2 = await groupMeUserSubscribeRequest(userId, clientId);
        let success3 = await groupMeGroupSubscribeRequest(clientId);
        let payload =   {
            "channel":"/meta/connect",
            "clientId": clientId,
            "connectionType":"websocket",
            "id":"4"
        }
        groupMeSocket = new WebSocketFaye.Client(url);
        groupMeSocket.on('open', function(event) {
            console.log('open');
            groupMeSocket.send(JSON.stringify(payload));
        });
            
        groupMeSocket.on('message', function(event) {
            console.log(event.data);
            let json = JSON.parse(event.data);
            let message = json[0];
            delegateGroupMeMessageType(message);
        });
            
        groupMeSocket.on('close', function(event) {
            console.log('close', event.code, event.reason);
            groupMeSocket = new WebSocketFaye.Client(url);
        });

        groupMeSocket.on('error', function (error) {
            groupMeSocket.close();
            groupMeSocket = new WebSocketFaye.Client(url);
        });
    } catch (error) {
        console.error(error);
    }
}

function getMyGroupMeUserId() {
    let url = "https://api.groupme.com/v3/users/me?token=" + config.groupme_access_token;
    let options = {
        method: 'GET',
        uri: url,
        json: true
    };

    return new Promise((resolve, reject) => {
        request(options)
            .then(function (body) {
                resolve(body.response.id);
            })
            .catch(function (error) {
                reject(new Error(error));
            });
    });
}

function groupMeHandshakeRequest() {
    let url = 'https://push.groupme.com/faye';
    let body = {
        "channel":"/meta/handshake",
        "version":"1.0",
        "supportedConnectionTypes":["websocket"],
        "id":"1"
    };
    let options = {
        method: 'POST',
        uri: url,
        body : body,
        json: true
    };

    return new Promise((resolve, reject) => {
        request(options)
            .then(function (body) {
                console.log(body);
                resolve(body[0].clientId);
            })
            .catch(function (error) {
                reject(new Error(error));
            });
    });
}

function groupMeUserSubscribeRequest(userId, clientId) {
    console.log(config.groupme_access_token);
    let url = 'https://push.groupme.com/faye';
    let body = {
        "channel":"/meta/subscribe",
        "clientId": clientId,
        "subscription": "/user/"+userId,
        "id":"2",
        "ext": {
            "access_token": config.groupme_access_token,
            "timestamp": Math.floor(new Date().getTime() / 1000)
        }
    };
    let options = {
        method: 'POST',
        uri: url,
        body : body,
        json: true
    };

    return new Promise((resolve, reject) => {
        request(options)
            .then(function (body) {
                console.log(body);
                resolve(body);
            })
            .catch(function (error) {
                reject(new Error(error));
            });
    });
}

function groupMeGroupSubscribeRequest(clientId) {
    let url = 'https://push.groupme.com/faye';
    let body = {
        "channel":"/meta/subscribe",
        "clientId": clientId,
        "subscription":"/group/36562884",
        "id":"3",
        "ext":
        {
            "access_token": config.groupme_access_token,
            "timestamp": Math.floor(new Date().getTime() / 1000)
        }
    };
    let options = {
        method: 'POST',
        uri: url,
        body : body,
        json: true
    };

    return new Promise((resolve, reject) => {
        request(options)
            .then(function (body) {
                console.log(body);
                resolve(body.successful);
            })
            .catch(function (error) {
                reject(new Error(error));
            });
    });
}

function botPostMessage(message) {
    let url = 'https://api.groupme.com/v3/bots/post';
    let body = {
        "text" : message,
        "bot_id" : config.groupme_bot_token
    }
    let options = {
        method: 'POST',
        uri: url,
        body : body,
        json: true
    };

    return new Promise((resolve, reject) => {
        request(options)
            .then(function (body) {
                resolve(body);
            })
            .catch(function (error) {
                reject(new Error(error));
            });
    });
}

// ---message processing functions

function delegateGroupMeMessageType(message) {
    if(message.channel === '/meta/connect' || message.data.type === 'ping' || message.data.subject.group_id !== '27335510') {
        return;
    }

    if(message.data.type === 'line.create') {
        if(message.data.subject.name !== 'thomas tedrow' && message.data.subject.name !== 'Music Aggregator') {
            //let message = "Hey " + message.data.subject.name + ", you suck!";
            //botPostMessage(message);
        }
        let spotifySongLink = "https://open.spotify.com/";
        if(message.data.subject.text.includes(spotifySongLink) && !message.data.subject.text.includes('playlist')) {
            processMessage(message, true);
        }
    } else if(message.data.type === 'typing') {
        console.log('captured typing event');
    } else if(message.data.type === 'like.create') {
        console.log('captured a like event');
    }
}

function musicDataDelegator(url) {
    let delegatefn;
    if(url.includes('album')) {
        delegatefn = querySpotifyAlbum;
    } else if(url.includes('artist')) {
        delegatefn = querySpotifyArtist;
    } else if(url.includes('track')) {
        delegatefn = querySpotifyTrack;
    }
    return delegatefn;
}

function querySpotifyAlbum(id, token) {
    let queryURL = "https://api.spotify.com/v1/albums/" + id;
    let options = {
        uri: queryURL,
        headers: {
            'Authorization': 'Bearer ' + token
        },
        json: true
    };
    
    return new Promise((resolve, reject) => {
        request(options)
            .then(function (body) {
                let musicData = {
                    artist : body.artists[0].name,
                    track: "",
                    album: body.name
                };
                resolve(musicData);
            })
            .catch(function (error) {
                reject(new Error(error));
            });
    });
}

function querySpotifyArtist(id, token) {
    let queryURL = "https://api.spotify.com/v1/artists/" + id;
    let options = {
        uri: queryURL,
        headers: {
            'Authorization': 'Bearer ' + token
        },
        json: true
    };
    
    return new Promise((resolve, reject) => {
        request(options)
            .then(function (body) {
                let musicData = {
                    artist : body.name,
                    track: "",
                    album: ""
                };
                resolve(musicData);
            })
            .catch(function (error) {
                reject(new Error(error));
            });
    });
}

function querySpotifyTrack(id, token) {
    let queryURL = "https://api.spotify.com/v1/tracks/" + id;
    let options = {
        uri: queryURL,
        headers: {
            'Authorization': 'Bearer ' + token
        },
        json: true
    };
    
    return new Promise((resolve, reject) => {
        request(options)
            .then(function (body) {
                let musicData = {
                    artist : body.artists[0].name,
                    track: body.name,
                    album: body.album.name
                };
                resolve(musicData);
            })
            .catch(function (error) {
                reject(new Error(error));
            });
    });
}

async function processMessage(message, isGroupMe) {
    let url = message.data.subject.text;
    let id = message.data.subject.id;
    let displayName = message.data.subject.name;
    let querySpotifyMusicData = musicDataDelegator(url);
    let musicId = url.substring(url.lastIndexOf('/') + 1);

    try {
        let accessToken = await getAccessToken();
        var musicData = await querySpotifyMusicData(musicId, accessToken);
    } catch (error) {
        console.error(error.message);
    }

    let formattedData = {
        id : id,
        name : musicData.track,
        artist : musicData.artist,
        album : musicData.album,
        link : url,
        user : displayName,
        reactions : 0,
        datetime : Math.floor(new Date().getTime() / 1000)
    };
    createSongRecord(formattedData);
}

// ---db functions

function initDB() {
    db = new sqlite3.Database('./songs.db', (error) => {
        if(error) {
            console.error(error.message);
        } else {
            console.log("connected to the database");
            db.run('CREATE TABLE IF NOT EXISTS songs(id text PRIMARY KEY, name text, artist text, album text, link text UNIQUE, user text, reactions integer, date_posted integer)', [], (error) => {
                if(error) {
                    console.error(error.message);
                } else {
                    console.log('songs table created');
                }
            });
        }
    });
}

function createSongRecord(data) {
    let params = [data.id, data.name, data.artist, data.album, data.link, data.user, data.reactions, data.datetime];
    let placeholders = '(?,?,?,?,?,?,?,?)';
    let sqlStmt = 'INSERT INTO songs(id, name, artist, album, link, user, reactions, date_posted) VALUES' + placeholders;
    db.run(sqlStmt, params, function(error) {
        if(error) {
            return console.error(error.message);
        }
        console.log(`inserted row ${this.lastID}`);
    })
}

function updateReactionCount(id, event, count) {
    let sqlStmt = 'SELECT reactions FROM songs WHERE id = ?';
    db.get(sqlStmt, [id], (error, row) => {
        if(error) {
            return console.error(error.message);
        }
        if(row) {
            let newCount = (event === 'add') ? row.reactions + 1 : row.reactions - 1;
            let params = [newCount, id];
            let sqlStmt = 'UPDATE songs SET reactions = ? WHERE id = ?';
            db.run(sqlStmt, params, function(error) {
              if (error) {
                return console.error(error.message);
              }
              console.log(`Row updated: ${this.changes}`);
            });
        }
    })
}

function querySongData(sqlStmt, res) {
    db.all(sqlStmt, [], (error, rows) => {
        if(error) {
            return console.error(error.message);
        }
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.json(rows);
    })
}