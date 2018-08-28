const { Router } = require('express');
const request = require('request');
const httpProxy = require('http-proxy');
const debug = require('debug');
const sqlite3 = require('sqlite3').verbose();
const loadConfig = require('../utils/config');
const proxy = require('../core/proxy');
const redirect = require('../core/redirect');
const serverManager = require('../core/serverManager');
const stats = require('../core/stats');
const getIp = require('../utils/getIp');
// const proxyConfig = require('../core/proxyConfig');
// const proxyActiveSessions = require('../core/proxyActiveSessions');

const logRoutes = debug('routes');

class Routes extends Router {
	constructor() {
		super();
		this._config = loadConfig();
		this._registerRoutes();
	}

	_registerRoutes() {
		this.get('/api/reload', this.reloadConfig.bind(this));
		this.get('/api/scores', this.scores.bind(this));
		this.get('/api/stats', this.stats.bind(this));
		this.get('/api/pathname/:downloadid', this.downloadId.bind(this));
		this.all('/api/plex/*', this.direct.bind(this));
		this.get('/video/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', redirect);
		this.get('/video/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', redirect);
		this.get('/video/:/transcode/universal/start', this.start.bind(this));
		this.get('/video/:/transcode/universal/start.m3u8', this.start.bind(this));
		this.get('/video/:/transcode/universal/start.mpd', this.startMpd.bind(this));
		this.get('/video/:/transcode/universal/subtitles', redirect);
		this.get('/video/:/transcode/universal/session/:sessionId/base/index.m3u8', redirect);
		this.get('/video/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', redirect);
		this.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', redirect);
		this.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.vtt', redirect);
		this.get('/video/:/transcode/universal/stop', this.stop.bind(this));
		this.get('/video/:/transcode/universal/ping', this.ping.bind(this));
		this.get('/:/timeline', this.timeline.bind(this));
		this.get('/status/sessions/terminate', this.terminate.bind(this));
		this.get('/library/parts/:id1/:id2/file.*', redirect);
		// this.get('/status/sessions', this.sessions.bind(this));
		// this.get('/', this.proxy.bind(this));
		this.all('*', this.catchAll.bind(this));
	}

	_getMap(res, pred = p => p) {
		let output = {};
		for (let node of this._config.cluster) {
			output[node] = pred(stats[node]);
		}
		res.json(output);
	}

	reloadConfig(_, res) {
		let success;
		try {
			this._config = loadConfig();
			success = true;
		} catch (e) {
			success = false;
			logRoutes(e);
			logRoutes(e.stack);
		}
		res.json({success: success});
	}

	scores(_, res) {
		this._getMap(res, c => serverManager.calculateServerLoad(c));
	}
	
	stats(_, res) {
		this._getMap(res);
	}
	
	downloadId(req, res) {
		try {
			const db = new sqlite3.Database(this._config.plex.database);
			db.get("SELECT * FROM media_parts WHERE id=? LIMIT 0,1", req.params.downloadid, (err, row) => {
				if (!err && row && row.file) {
					res.json(row);
				}
				else {
					res.status(404).send('File not found in Plex Database');
				}
				db.close();
			});
		}
		catch (err) {
			res.status(404).send('File not found in Plex Database');
		}
	}
	
	direct(req, res) {
		req.url = req.url.slice('/api/plex'.length);
		return proxy.web(req, res);
	}

	startMpd(req, res) {	
		let sessionId = false;
		if (typeof(req.query['X-Plex-Session-Identifier']) !== void(0)
				&& typeof(serverManager.cacheSession[req.query['X-Plex-Session-Identifier']]) !== void(0)) {
			sessionId = serverManager.cacheSession[req.query['X-Plex-Session-Identifier']];
		}
		
		if (sessionId !== false) {
			const serverUrl = serverManager.chooseServer(sessionId, getIp(req));
			request(`${serverUrl}/video/:/transcode/universal/stop?session=${sessionId}`, () => {
				serverManager.saveSession(req);
				redirect(req, res);
			});
		}
		else {
			serverManager.saveSession(req);
			redirect(req, res);
		}
	}

	start(req, res) {
		serverManager.saveSession(req);
		redirect(req, res);
	}

	stop(req, res) {
		proxy.web(req, res);
		
		const sessionId = serverManager.getSession(req);
		const serverUrl = serverManager.chooseServer(sessionId, getIp(req));

		request(`${serverUrl}/video/:/transcode/universal/stop?session=${sessionId}`);
		
		setTimeout(() => {
			serverManager.removeSession(sessionId);
			if (typeof(serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']]) !== void(0)) {
				delete serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']];
			}
		}, 1000);
	}

	ping(req, res) {
		proxy.web(req, res);
		const sessionId = serverManager.getSession(req);
		const serverUrl = serverManager.chooseServer(sessionId, getIp(req));
		request(`${serverUrl}/video/:/transcode/universal/ping?session=${sessionId}`);
	}

	timeline(req, res) {
		const sessionId = serverManager.getSession(req);
		const serverUrl = serverManager.chooseServer(sessionId, getIp(req));
		
		let cproxy;
		if (typeof(req.query['X-Plex-Session-Identifier']) !== void(0)
				&& typeof(serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']]) !== void(0)) {
			cproxy = httpProxy.createProxyServer({
				target: {
					host: this._config.plex.host,
					port: this._config.plex.port
				},
				selfHandleResponse: true
			});
			cproxy.on('proxyRes', (proxyRes, req, res) => {
				let body = new Buffer('');
				proxyRes.on('data', (data) => {
					body = Buffer.concat([body, data]);
				});
				proxyRes.on('end', () => {
					body = body.toString();
					res.header('Content-Type', 'text/xml;charset=utf-8');
					res.send(body.replace('<MediaContainer ', `<MediaContainer terminationCode="2006" terminationText="${serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']].replace('"', '&#34;')}" `));
				});
			})
			cproxy.on('error', (err, _, res) => {
				logRoutes('error', err);
				res.writeHead(404, {});
				res.end('Plex not respond in time, proxy request fails');
			});
		}
		else {
			cproxy = proxy;
		}
		
		if (req.query.state == 'stopped' || (typeof(req.query['X-Plex-Session-Identifier']) !== void(0)
				&& typeof(serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']]) !== void(0))) {
			cproxy.web(req, res);
			
			request(`${serverUrl}/video/:/transcode/universal/stop?session=${sessionId}`);			
			setTimeout(() => {
				serverManager.removeSession(sessionId);
				if (typeof(serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']]) !== void(0)) {
					delete serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']];
				}
			}, 1000);
		}
		else {
			proxy.web(req, res);
			request(`${serverUrl}/video/:/transcode/universal/ping?session=${sessionId}`);
		}
	}

	terminate(req, res) {
		res.header('Content-Type', 'text/xml;charset=utf-8');
		res.send('<?xml version="1.0" encoding="UTF-8"?><MediaContainer size="0"></MediaContainer>');
		const sessionId = req.query.sessionId;
		const reason = req.query.reason;
		if (typeof(sessionId) !== void(0) && typeof(reason) !== void(0)) {
			serverManager.forceStopStream(sessionId, reason);
		}
	}

/*
	sessions(req, res) {
		proxyActiveSessions.web(req, res);
	}

	proxy(req, res) {
		if (req.query['X-Plex-Device-Name'])
			proxyConfig.web(req, res);
		else
			proxy.web(req, res);
	}
*/

	catchAll(req, res) {
		proxy.web(req, res);
	}
}

module.exports = new Routes();
