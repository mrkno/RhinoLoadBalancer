class ServerManager {
	constructor(transcoderManager) {
		this._cacheSession = {};
		this._sessions = {};
		this._stoppedSessions = {};
		this._transcoderManager = transcoderManager;
	}

	saveSession(req) {
		if (req.query['X-Plex-Session-Identifier'] !== void(0) && req.query.session !== void(0)) {
			this._cacheSession[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
		}
	}

	getSession(req) {
		return req.params.sessionId
			|| req.query.session
			|| this._cacheSession[req.query['X-Plex-Session-Identifier']]
			|| req.query['X-Plex-Session-Identifier']
			|| req.query['X-Plex-Client-Identifier']
			|| false;
	}

	getStoppedSession(plexSessionIdentifier) {
		return this._stoppedSessions[plexSessionIdentifier];
	}

	removeServer(url) {
		for (let session in this._sessions) {
			if (this._sessions[session] === url) {
				delete this._sessions[session];
			}
		}
	}

	forceStopStream(session, reason) {
		this._stoppedSessions[session] = reason;
	}

	chooseServer(session, req) {
		if (!this._transcoderManager.any()) {
			return false;
		}
		else if (this._sessions[session] !== void(0) && this._transcoderManager.exists(this._sessions[session])) {
			return this._sessions[session];
		}

		let ip;
		const fwdHeader = req.headers['forwarded'];
		if (fwdHeader) {
			const startIndex = fwdHeader.indexOf('for=') + 4;
			const length = fwdHeader.substr(startIndex).search(/(,| |"|$)/);
			ip = fwdHeader.substr(startIndex, length);
		}
		else {
			ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress;
		}

		const assignedServer = this._transcoderManager.assignServer(ip);
		this._sessions[session] = assignedServer;
		return assignedServer;
	}

	removeSession(session, plexSessionIdentifier) {
		delete this._sessions[session];
		delete this._stoppedSessions[session];
		delete this._stoppedSessions[plexSessionIdentifier];
	}
}

module.exports = ServerManager;
