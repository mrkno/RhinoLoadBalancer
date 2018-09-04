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
	}

	_registerRoutes() {
        this._router.use('/sessions', express.static(this._config.plex.sessions));
        this._io.on('connection', this.setupWebsocket.bind(this));
    }

    static _generateUid() {
        return crypto.randomBytes(16).toString("hex");
    }

    _getWebsockets() {
        return this._io.sockets.clients();
    }

    _handleData(ws, json) {
        const eventId = json.eventId;
        switch (json.event) {
            case 'load':
                this._transcoderServers.update(ws.rhinoId, json);
                break;
            case 'path':
                this._downloadId(ws, eventId, json.downloadId);
                break;
            case 'redis':
                sessionStore.handleRemoteTranscodeRequest(json);
                break;
            default:
                console.error(`Unknown event: ${JSON.stringify(json)}`);
                break;
        }
    }

    _downloadId(ws, eventId, downloadid) {
        const response = {
            event: 'load',
            eventId: eventId,
            data: null
        };
		try {
			const db = new sqlite3.Database(this._config.plex.database);
			db.get("SELECT * FROM media_parts WHERE id=? LIMIT 0,1", downloadid, (err, row) => {
				if (!err && row && row.file) {
                    response.data = row;
				}
                ws.send(JSON.stringify(response));
				db.close();
			});
		}
		catch (err) {
            ws.send(JSON.stringify(response));
		}
	}

    _handleClose(ws) {
        console.error(`Transcoder id=${ws.rhinoId} disconnected.`);
        this._transcoderServers.remove(ws.rhinoId);
    }

    setupWebsocket(ws) {
        ws.rhinoId = RhinoRoutes._generateUid();
        console.log(`New transcoder with id=${ws.rhinoId} connected.`);
        ws.on('message', this._handleData.bind(this, ws));
        ws.on('disconnect', this._handleClose.bind(this, ws));
        ws.on('error', this._handleClose.bind(this, ws));
        ws.on('close', this._handleClose.bind(this, ws));
    }

	toRoutes() {
		return this._router;
	}
}

module.exports = (config, io, transcoderServers) => {
	const router = new RhinoRoutes(config, io, transcoderServers);
	return router.toRoutes();
};
