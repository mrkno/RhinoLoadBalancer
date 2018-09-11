const geolite2 = require('geolite2');
const maxmind = require('maxmind');

class TranscoderServers {
	constructor() {
		this._transcoders = [];
		this._iplookup = maxmind.openSync(geolite2.paths.country);
	}

	_calculateServerLoad(loadStats) {
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

	_findById(id) {
		return this._transcoders.find(t => t.id === id);
	}

	_findByUrl(accessUrl) {
		return this._transcoders.find(t => t.accessUrl === accessUrl);
	}

	assignServer(ip) {
		const continent = this._getContinent(ip);
		const avalibleServers = {};
		const serverList = [];
		for (let loadStats of this._transcoders) {
			const load = this._calculateServerLoad(loadStats);
			if (load >= 0) {
				avalibleServers[loadStats.id] = {
					load,
					continent: loadStats.continent
				};
				serverList.push(loadStats.id);
			}
		}

		const continentalLoads = serverList
			.filter(id => avalibleServers[id].continent === continent)
			.sort(id => avalibleServers[id].load);

		let serverId;
		if (continentalLoads[0] !== void(0)) {
			// get the geographically closest, lowest load node
			serverId = continentalLoads[0];
		}
		else {
			// the lowest load global node
			serverId = serverList.sort(id => avalibleServers[id])[0];
		}
		return this._findById(serverId).accessUrl;
	}

	exists(accessUrl) {
		return this._findByUrl(accessUrl) !== void(0);
	}

	any() {
		return this._transcoders.length > 0;
	}

	update(id, transcoderData) {
		const prev = this._findById(id);
		if (prev !== void(0)) {
			for (const key in transcoderData) {
				prev[key] = transcoderData[key];
			}
		}
		else {
			transcoderData.id = id;
			transcoderData.continent = this._getContinent(transcoderData.ip);
			this._transcoders.push(transcoderData);
		}
	}

	remove(id) {
		const index = this._transcoders.findIndex(t => t.id === id);
		if (index >= 0) {
			this._transcoders.splice(index, 1);
		}
	}
}

module.exports = TranscoderServers;
