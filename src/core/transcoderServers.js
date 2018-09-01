
const geolite2 = require('geolite2');
const maxmind = require('maxmind');

class TranscoderServers {
	constructor() {
		this._transcoders = {};
		this._iplookup = maxmind.openSync(geolite2.paths.country);
	}

	_calculateServerLoad(id) {
		const loadStats = this._transcoders[id];
		if (!loadStats || loadStats.config.maxTotalStreams >= loadStats.currentTotal) {
			return -1;
		}
		let load = loadStats.transcoding || 0;
		if (loadStats.codecs.hevc) {
			load += loadStats.codecs.hevc * 1.5;
		}		
		if (loadStats.config && loadStats.sessions >= loadStats.config.preferredMaxSessions) {
			load += 2.5;
		}
		if (loadStats.config && loadStats.transcoding >= loadStats.config.preferredMaxTranscodes) {
			load += 5;
		}
		if (loadStats.config && loadStats.downloads >= loadStats.config.preferredMaxDownloads) {
			load += 1;
		}
		return load;
	}

	_getContinent(ip) {
		try {
			return this._iplookup.get(ip).continent.code;
		}
		catch(e) {
			return '';
		}
	}

	assignServer(ip) {
		const continent = this._getContinent(ip);
		const avalibleServers = {};
		const serverList = [];
		for (let id of Object.keys(this._transcoders)) {
			const load = this._calculateServerLoad(id);
			if (load >= 0) {
				avalibleServers[id] = {
					load: load,
					continent: this._transcoders[id].continent
				};
				serverList.push(id);
			}
		}

		const continentalLoads = serverList
			.filter(id => avalibleServers[id].continent === continent)
			.sort(id => avalibleServers[id].load);

		// try get the geographically closest, lowest load node
		if (continentalLoads[0] !== void(0)) {
			return continentalLoads[0];
		}

		// the lowest load global node
		return serverList.sort(id => avalibleServers[id])[0];
	}

	exists(id) {
		return this._transcoders[id] !== void(0);
	}

	any() {
		return Object.keys(this._transcoders).length > 0;
	}

	update(id, transcoderData) {
		if (!this._transcoders[id]) {
			transcoderData.continent = this._getContinent(transcoderData.ip);
		}
		transcoderData.continent = this._transcoders[id];
		this._transcoders[id] = transcoderData;
	}

	remove(id) {
		delete this._transcoders[id];
	}
}

module.exports = TranscoderServers;
