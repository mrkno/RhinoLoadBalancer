const debug = require('debug');
const serverManager = require('./serverManager');
const getIp = require('../utils/getIp');

const logRedirect = debug('redirect');

module.exports = (req, res) => {
	const sessionId = serverManager.getSession(req);
	const serverUrl = serverManager.chooseServer(sessionId, getIp(req));

	res.writeHead(302, {
		Location: serverUrl + req.url
	});
	res.end();
	
	logRedirect(`Send 302 for ${sessionId} to ${serverUrl}`);
};
