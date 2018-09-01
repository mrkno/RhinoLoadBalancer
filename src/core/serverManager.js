const loadConfig = require('../utils/config');
const stats = require('../core/stats');

class ServerManager {
	constructor() {
		this._cacheSession = {};
		this._sessions = {};
		this._stoppedSessions = {};
		this._config = loadConfig();
	}

	saveSession(req) {
		if (typeof (req.query['X-Plex-Session-Identifier']) !== void(0) && typeof (req.query.session) !== void(0)) {
			this._cacheSession[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
		}
	}

	calculateServerLoad(stats) {
		if (!stats) {
			return 1000;
		}
		let load = stats.transcoding || 0;
		if (stats.codecs.hevc) {
			load += stats.codecs.hevc * 1.5;
		}		
		if (stats.config && stats.sessions >= stats.config.preferredMaxSessions) {
			load += 2.5;
		}
		if (stats.config && stats.transcoding >= stats.config.preferredMaxTranscodes) {
			load += 5;
		}
		if (stats.config && stats.downloads >= stats.config.preferredMaxDownloads) {
			load += 1;
		}
		return load;
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
		if (this._config.cluster.length === 0) {
			return false;
		}
		else if (typeof(this._sessions[session]) !== void(0) &&
				this._config.cluster.indexOf(this._sessions[session]) != -1 &&
				stats[this._sessions[session]]) {
			return this._sessions[session];
		}

		const sortedServers = this._config.cluster.sort(url => this.calculateServerLoad(stats[url]));
		this._sessions[session] = sortedServers[0];
		return sortedServers[0];
	}

	removeSession(session) {
		delete this._sessions[session];
		delete this._stoppedSessions[session];
	}
}

module.exports = new ServerManager();