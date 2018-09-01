class ServerManager {
	constructor(transcoderStats) {
		this._cacheSession = {};
		this._sessions = {};
		this._stoppedSessions = {};
		this._transcoders = transcoderStats;
	}

	saveSession(req) {
		if (typeof (req.query['X-Plex-Session-Identifier']) !== void(0) && typeof (req.query.session) !== void(0)) {
			this._cacheSession[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
		}
	}

	getSession(req) {
		if (typeof(req.params.sessionId) !== void(0)) {
			return req.params.sessionId;
		}
		else if (typeof(req.query.session) !== void(0)) {
			return req.query.session;
		}
		else if (typeof(req.query['X-Plex-Session-Identifier']) !== void(0) && typeof(this._cacheSession[req.query['X-Plex-Session-Identifier']]) !== void(0)) {
			return this._cacheSession[req.query['X-Plex-Session-Identifier']];
		}
		else if (typeof(req.query['X-Plex-Session-Identifier']) !== void(0)) {
			return req.query['X-Plex-Session-Identifier'];
		}
		else if (typeof(req.query['X-Plex-Client-Identifier']) !== void(0)) {
			return req.query['X-Plex-Client-Identifier'];
		}
		return false;
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

	chooseServer(session) {
		if (this._transcoders.any()) {
			return false;
		}
		else if (this._sessions[session] !== void(0) && this._transcoders.exists(this._sessions[session])) {
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

		const assignedServer = this._transcoders.assignServer(ip);
		this._sessions[session] = assignedServer;
		return assignedServer;
	}

	removeSession(session) {
		delete this._sessions[session];
		delete this._stoppedSessions[session];
	}
}

module.exports = ServerManager;
