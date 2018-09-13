const express = require('express');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const SessionStore = require('../core/sessionStore');

class RhinoRoutes {
	constructor(config, io, transcoderServers) {
        this._config = config;
        this._io = io;
        this._transcoderServers = transcoderServers;
		this._router = new express.Router();
        this._wsEvents = {};
        this._registerRoutes();
        this._sessionStore = new SessionStore();
    }
    
    _registerWsEvent(event, handler) {
        this._wsEvents[event] = handler.bind(this);
    }

	_registerRoutes() {
        this._router.use('/sessions', express.static(this._config.plex.sessions));
        this._router.post('/new/:sessionId', this.newSession.bind(this));
        this._registerWsEvent('load', this.loadEvent);
        this._registerWsEvent('path', this.pathEvent);
        this._registerWsEvent('session', this.sessionEvent);
        this._registerWsEvent('get_pattern', this.getPatternKeyEvent);
        this._registerWsEvent('get_key', this.getKeyEvent);
        this._registerWsEvent('update_key', this.updateKeyEvent);
        this._registerWsEvent('delete_key', this.deleteKeyEvent);
        this._io.on('connection', this._setupWebsocket.bind(this));
    }

    static _generateUid() {
        return crypto.randomBytes(16).toString('hex');
    }

    _handleClose(ws) {
        console.error(`Transcoder id=${ws.rhinoId} disconnected.`);
        this._transcoderServers.remove(ws.rhinoId);
    }

    _setupWebsocket(ws) {
        ws.rhinoId = RhinoRoutes._generateUid();
        console.log(`New transcoder with id=${ws.rhinoId} connected.`);
        ws.on('message', this._handleData.bind(this, ws));
        ws.on('disconnect', this._handleClose.bind(this, ws));
        ws.on('error', this._handleClose.bind(this, ws));
        ws.on('close', this._handleClose.bind(this, ws));
    }

    async _handleData(ws, json) {
        const handler = this._wsEvents[json.event];
        if (!handler) {
            console.error(`Unknown event: ${JSON.stringify(json)}`);
            return;
        }
        let response = await handler(json, ws);
        if (response) {
            if (typeof(response) !== 'object' || Array.isArray(response)) {
                response = {
                    data: response
                };
            }
            const event = Object.assign(response, {
                event: json.event,
                eventId: json.eventId
            });
            ws.binary(true).compress(true).emit('message', event);
        }
    }

    newSession(req, res) {
        const sessionId = req.params.sessionId;
        this._sessionStore.store(sessionId, req.body);
        res.send({success: true});
    }

    sessionEvent(json) {
        return this._sessionStore.getSession(json.sessionId);
    }

    loadEvent(json, ws) {
        this._transcoderServers.update(ws.rhinoId, json);
    }

    pathEvent(json) {
        return new Promise(resolve => {
            try {
                const db = new sqlite3.Database(this._config.plex.database);
                db.get('SELECT * FROM media_parts WHERE id=? LIMIT 0,1', json.downloadId, (err, row) => {
                    let data = null;
                    if (!err && row && row.file) {
                        data = row;
                    }
                    db.close();
                    resolve({
                        data
                    });
                });
            }
            catch (err) {
                resolve({
                    data: null
                });
            }
        });
    }

    getPatternKeyEvent(json) {
        return this._sessionStore.keys(json.pattern);
    }

    getKeyEvent(json) {
        return this._sessionStore.get(json.key);
    }

    updateKeyEvent(json) {
        return this._sessionStore.set(json.key, json.val);
    }

    deleteKeyEvent(json) {
        return this._sessionStore.del(json.keys);
    }

	toRoutes() {
		return this._router;
	}
}

module.exports = (config, io, transcoderServers) => {
	const router = new RhinoRoutes(config, io, transcoderServers);
	return router.toRoutes();
};
