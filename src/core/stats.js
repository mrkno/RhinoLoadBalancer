const request = require('request');
const config = require('../config');

let serversStats = {};

const sendAlertDead = (url) => {

};

const sendAlertAlive = (url) => {

};

const getInformations = () => {
	config.cluster.map((url) => {
		request(url + '/api/stats', (error, response, body) => {
			try {
				if (!error)
				{
					const notif = (serversStats[url] === false);
					serversStats[url] = JSON.parse(body);
					if (notif)
						sendAlertAlive(url);
				}
				else
				{
					if (serversStats[url] !== false)
						sendAlertDead(url);
					serversStats[url] = false;
				}
			}
			catch (err) {
				if (serversStats[url] !== false)
					sendAlertDead(url);
				serversStats[url] = false;
			}
		})
	});
};

setInterval(() => {
	getInformations();
}, 2000);

getInformations();

module.exports = serversStats;