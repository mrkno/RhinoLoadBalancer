class TranscoderServers {
	constructor() {
		this._transcoders = {};
	}

	_calculateServerLoad(loadStats) {
		if (!loadStats) {
			return 1000;
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

	assignServer() {
		return Object.keys(this._transcoders).sort(id => this._calculateServerLoad(id))[0];
	}

	exists(id) {
		return this._transcoders[id] !== void(0);
	}

	any() {
		return Object.keys(this._transcoders).length > 0;
	}

	update(id, stats) {
		this._transcoders[id] = stats;
	}

	remove(id) {
		delete this._transcoders[id];
	}
}

module.exports = TranscoderServers;
