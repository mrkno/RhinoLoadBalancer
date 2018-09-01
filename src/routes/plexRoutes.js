const { Router } = require('express');
const request = require('request');
const httpProxy = require('http-proxy');

class PlexRoutes {
	constructor(config, serverManager) {
		this._router = new Router();
		this._serverManager = serverManager;
		this._config = config;
		this._registerRoutes();
		this._setupProxies();
	}

	_setupProxies() {
		const interceptProxy = httpProxy.createProxyServer({
			target: {
				host: this._config.plex.host,
				port: this._config.plex.port
			},
			selfHandleResponse: customHandling
		});
		interceptProxy.on('proxyRes', (proxyRes, req, res) => {
			let body = new Buffer('');
			proxyRes.on('data', data => {
				body = Buffer.concat([body, data]);
			});
			proxyRes.on('end', () => {
				body = body.toString();
				res.header('Content-Type', 'text/xml;charset=utf-8');
				res.send(body.replace('<MediaContainer ', `<MediaContainer terminationCode="2006" terminationText="${this._serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']].replace('"', '&#34;')}" `));
			});
		})
		interceptProxy.on('error', this._onProxyError);

		const passthroughProxy = httpProxy.createProxyServer({
			target: {
				host: this._config.plex.host,
				port: this._config.plex.port
			}
		});
		passthroughProxy.on('error', this._onProxyError);

		this._interceptProxy = interceptProxy;
		this._passthroughProxy = passthroughProxy;
	}

	_onProxyError(err, _, res) {
		console.log(`[ERROR] ${err}`);
		res.writeHead(404, {});
		res.end('Plex did not respond in time, request failure');
	}

	_registerRoutes() {	
		this._router.get('/video/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', this._redirect);
		this._router.get('/video/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', this._redirect);
		this._router.get('/video/:/transcode/universal/start', this.start.bind(this));
		this._router.get('/video/:/transcode/universal/start.m3u8', this.start.bind(this));
		this._router.get('/video/:/transcode/universal/start.mpd', this.startMpd.bind(this));
		this._router.get('/video/:/transcode/universal/subtitles', this._redirect);
		this._router.get('/video/:/transcode/universal/session/:sessionId/base/index.m3u8', this._redirect);
		this._router.get('/video/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', this._redirect);
		this._router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', this._redirect);
		this._router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.vtt', this._redirect);
		this._router.get('/video/:/transcode/universal/stop', this.stop.bind(this));
		this._router.get('/video/:/transcode/universal/ping', this.ping.bind(this));
		this._router.get('/:/timeline', this.timeline.bind(this));
		this._router.get('/status/sessions/terminate', this.terminate.bind(this));
		this._router.get('/library/parts/:id1/:id2/file.*', this._redirect);
	}

	_redirect(req, res) {
		const sessionId = this._serverManager.getSession(req);
		const serverUrl = this._serverManager.chooseServer(sessionId);
		res.status(302).location(serverUrl + req.url);
	}

	startMpd(req, res) {	
		let sessionId = false;
		if (req.query['X-Plex-Session-Identifier'] !== void(0)
				&& this._serverManager.cacheSession[req.query['X-Plex-Session-Identifier']] !== void(0)) {
			sessionId = this._serverManager.cacheSession[req.query['X-Plex-Session-Identifier']];
		}
		
		if (sessionId !== false) {
			const serverUrl = this._serverManager.chooseServer(sessionId);
			request(`${serverUrl}/video/:/transcode/universal/stop?session=${sessionId}`, () => {
				this._serverManager.saveSession(req);
				this._redirect(req, res);
			});
		}
		else {
			this._serverManager.saveSession(req);
			this._redirect(req, res);
		}
	}

	start(req, res) {
		this._serverManager.saveSession(req);
		this._redirect(req, res);
	}

	stop(req, res) {		
		const sessionId = this._serverManager.getSession(req);
		const serverUrl = this._serverManager.chooseServer(sessionId);

		request(`${serverUrl}/video/:/transcode/universal/stop?session=${sessionId}`);
		
		setTimeout(() => {
			this._serverManager.removeSession(sessionId);
			if (this._serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']] !== void(0)) {
				delete this._serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']];
			}
		}, 1000);
	}

	ping(req, res) {
		const sessionId = this._serverManager.getSession(req);
		const serverUrl = this._serverManager.chooseServer(sessionId);
		request(`${serverUrl}/video/:/transcode/universal/ping?session=${sessionId}`);
	}

	timeline(req, res) {
		const sessionId = this._serverManager.getSession(req);
		const serverUrl = this._serverManager.chooseServer(sessionId);
		const customHandling = req.query['X-Plex-Session-Identifier'] !== void(0)
			&& this._serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']] !== void(0);
		const proxy = customHandling ? this._interceptProxy : this._passthroughProxy;

		if (req.query.state == 'stopped' || customHandling) {
			proxy.web(req, res);
			request(`${serverUrl}/video/:/transcode/universal/stop?session=${sessionId}`);			
			setTimeout(() => {
				this._serverManager.removeSession(sessionId);
				if (this._serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']] !== void(0)) {
					delete this._serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']];
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
		if (sessionId !== void(0) && reason !== void(0)) {
			this._serverManager.forceStopStream(sessionId, reason);
		}
	}

	toRoutes() {
		return this._router;
	}
}

module.exports = (config, serverManager) => {
	const router = new PlexRoutes(config, serverManager);
	return router.toRoutes();
};
