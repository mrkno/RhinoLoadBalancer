const httpProxy = require('http-proxy');
const loadConfig = require('../utils/config');

class ProxyBase {
	constructor(selfHandleResponse = void(0)) {
		const config = loadConfig();
		this._proxy = httpProxy.createProxyServer({
			target: {
				host: config.plex.host,
				port: config.plex.port
			},
			selfHandleResponse: selfHandleResponse
		});
		proxy.on('error', this._proxy);
	}

	onError(_1, _2, res) {
		res.writeHead(404, {});
		res.end('Plex not respond in time, proxy request fails');
	}
}

module.exports = ProxyBase;
