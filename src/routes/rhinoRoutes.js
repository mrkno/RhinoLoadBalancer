const express = require('express');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const sessionStore = require('../core/sessionStore');

class RhinoRoutes {
	constructor(config, io, transcoderServers) {
        this._config = config;
        this._io = io;
        this._transcoderServers = transcoderServers;
		this._router = new express.Router();
        this._registerRoutes();
        this._wsEvents = {};
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
        return crypto.randomBytes(16).toString("hex");
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
        const response = await handler(json, ws);
        if (response) {
            ws.binary(true).compress(true).emit('message', Object.assign(response, {
                event: json.event,
                eventId: json.eventId
            }));
        }
    }

    newSession(req, res) {
        const sessionId = req.params.sessionId;
        const json = JSON.parse(req.body);
        sessionStore.store(sessionId, json);
        res.send({success: true});
    }

    sessionEvent(json) {
        return sessionStore.get(json.sessionId);
    }

    loadEvent(json, ws) {
        this._transcoderServers.update(ws.rhinoId, json);
    }

    pathEvent(json) {
        return new Promise(resolve => {
            try {
                const db = new sqlite3.Database(this._config.plex.database);
                db.get("SELECT * FROM media_parts WHERE id=? LIMIT 0,1", json.downloadId, (err, row) => {
                    let data = null;
                    if (!err && row && row.file) {
                        data = row;
                    }
                    db.close();
                    resolve({
                        data: data
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

    getPatternKeyEvent(json, ws) {

    }

    getKeyEvent(json, ws) {

    }

    updateKeyEvent(json, ws) {

    }

    deleteKeyEvent(json, ws) {

    }

	toRoutes() {
		return this._router;
	}
}

module.exports = (config, io, transcoderServers) => {
	const router = new RhinoRoutes(config, io, transcoderServers);
	return router.toRoutes();
};
