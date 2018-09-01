const { Router } = require('express');
const sqlite3 = require('sqlite3').verbose();

class RhinoRoutes {
	constructor(config, instance, transcoderServers) {
        this._config = config;
        this._instance = instance;
        this._transcoderServers = transcoderServers;
		this._router = new Router();
        this._registerRoutes();
        this._heatbeatInterval = setInterval(this._heatbeat.bind(this), this._config.loadBalancer.heatbeatTimeout || 5000);
	}

	_registerRoutes() {
        this._router.use('/sessions', express.static(this._config.plex.sessions));
        this._router.ws('/comms', this.setupWebsocket.bind(this));
    }

    static _generateUid() {
        return crypto.randomBytes(16).toString("hex");
    }

    _getWebsockets() {
        return this._instance.getWss().clients;
    }

    _handleClose(ws) {
        ws.terminate();
        this._transcoderServers.remove(ws.rhinoId);
    }

    _heatbeat() {
        for (let ws of this._getWebsockets()) {
            if (ws.isAlive === false) {
                this._handleClose(ws);
            }
            else {
                ws.isAlive = false;
                ws.ping(() => {});
            }
        }
    }

    _handleData(ws, data) {
        const json = JSON.parse(data);
        const eventId = data.eventId;
        switch (json.event) {
            case 'load':
                this._transcoderServers.update(ws.rhinoId, json.stats);
                break;
            case 'path':
                this._downloadId(ws, eventId, json.downloadId);
                break;
            default:
                console.error(`Unknown event: ${data}`);
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

    setupWebsocket(ws) {
        ws.isAlive = true;
        ws.rhinoId = RhinoRoutes._generateUid();
        ws.on('pong', () => ws.isAlive = true);
        ws.on('message', this._handleData.bind(this, ws));
        ws.on('error', this._handleClose.bind(this, ws));
        ws.on('close', this._handleClose.bind(this, ws));
    }

	toRoutes() {
		return this._router;
	}
}

module.exports = (config, instance, transcoderServers) => {
	const router = new RhinoRoutes(config, instance, transcoderServers);
	return router.toRoutes();
};
