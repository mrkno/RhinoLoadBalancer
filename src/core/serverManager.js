const rangeCheck = require('range_check');
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
		// The configuration is unavailable, the server is probably unavailable
		if (!stats)
			return 1000;
	
		// Default load 0
		let load = 0;
	
		// Each transcode add 1 to the load
		load += stats.transcoding;
	
		// Each HEVC sessions add 1.5 to the load
		if (stats.codecs.hevc)
			load += stats.codecs.hevc * 1.5;
	
		// Server already have too much sessions
		if (stats.config && stats.sessions >= stats.config.preferredMaxSessions)
			load += 2.5;
	
		// Server already have too much transcodes
		if (stats.config && stats.transcoding >= stats.config.preferredMaxTranscodes)
			load += 5;
	
		// Server already have too much downloads
		if (stats.config && stats.downloads >= stats.config.preferredMaxDownloads)
			load += 1;
	
		// Return load
		return load;
	}

	getSession(req) {
		if (typeof (req.params.sessionId) !== void(0))
			return (req.params.sessionId);
		if (typeof (req.query.session) !== void(0))
			return (req.query.session);
		if (typeof (req.query['X-Plex-Session-Identifier']) !== void(0) && typeof (this._cacheSession[req.query['X-Plex-Session-Identifier']]) !== void(0))
			return (this._cacheSession[req.query['X-Plex-Session-Identifier']]);
		if (typeof (req.query['X-Plex-Session-Identifier']) !== void(0))
			return (req.query['X-Plex-Session-Identifier']);
		if (typeof (req.query['X-Plex-Client-Identifier']) !== void(0))
			return (req.query['X-Plex-Client-Identifier']);
		return false;
	}

	removeServer(url) {
		for (let session in this._sessions) {
			if (this._sessions[session] == url)
				delete this._sessions[session];
		}
	}

	forceStopStream(session, reason) {
		this._stoppedSessions[session] = reason;
	}

	chooseServer(session, ip = false) {
		if (this._config.preprod.enabled && ip) {
			if (this._config.preprod.devIps.some(p => rangeCheck.inRange(ip, p))) {
				return this._config.preprod.server;
			}
			else {
				return `${this._config.plex.host}:${this._config.plex.port}`;
			}
		}

		let count = this._config.cluster.length;
		if (count == 0)
			return (false);
		if (typeof (this._sessions[session]) !== void(0) &&
			this._config.cluster.indexOf(this._sessions[session]) != -1 &&
			stats[this._sessions[session]]) {
			return (this._sessions[session]);
		}

		let sortedServers = this._config.cluster.sort((url) => { return (this.calculateServerLoad(stats[url])); });

		this._sessions[session] = sortedServers[0];

		return (sortedServers[0]);
	}

	removeSession(session) {
		delete this._sessions[session];
		delete this._stoppedSessions[session];
	}
}

module.exports = new ServerManager();