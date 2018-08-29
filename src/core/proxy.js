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
		this._proxy.on('error', this.onError);
		this.ws = this._proxy.ws.bind(this._proxy);
		this.web = this._proxy.web.bind(this._proxy);
	}

	onError(_1, _2, res) {
		res.writeHead(404, {});
		res.end('Plex did not respond in time, request failure');
	}
}

module.exports = new ProxyBase();
