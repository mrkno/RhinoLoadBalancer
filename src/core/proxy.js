const httpProxy = require('http-proxy');
const config = require('../config');

const proxy = httpProxy.createProxyServer({
	target: {
		host: config.plex.host,
		port: config.plex.port
	}
});

proxy.on('error', (err, req, res) => {
	res.writeHead(404, {});
	res.end('Plex not respond in time, proxy request fails');
});

module.exports = proxy;