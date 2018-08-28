const ProxyBase = require('./proxy');

class ProxyConfig extends ProxyBase {
	constructor() {
		super(true);
		this._proxy.on('proxyRes', this.proxyRes.bind(this));
	}

	proxyRes(proxyRes, _, res) {
		let body = new Buffer('');
		proxyRes.on('data', data => {
			body = Buffer.concat([body, data]);
		});
		proxyRes.on('end', () => {
			body = body.toString();
			res.header('Content-Type', 'text/xml;charset=utf-8');
			res.send(body
				.replace('streamingBrainABRVersion=', 'DISABLEDstreamingBrainABRVersion=') // Disable Streaming adaptative
				.replace('allowSync="1"', 'allowSync="0"') // Disable Sync option
				.replace('sync="1"', 'DISABLEDsync="1"') // Disable Sync option
				.replace('updater="1"', 'updater="0"') // Disable updates
				.replace('backgroundProcessing="1"', 'DISABLEDbackgroundProcessing="1"') // Disable Optimizing feature
				.replace('livetv="', 'DISABLEDlivetv="') // Disable LiveTV
				.replace('allowTuners="', 'DISABLEDallowTuners="') // Disable Tuners
				.replace('ownerFeatures="', 'ownerFeatures="session_kick,') // Enable Session Kick Feature
			);
		});
	}
}

module.exports = ProxyConfig;
