#!/usr/bin/env node

const app = require('./app');
const loadConfig = require('./utils/config');
const debug = require('debug');
const http = require('http');
const proxy = require('./core/proxy');

const logServer = debug('server');
const config = loadConfig();

app.set(config.loadBalancer.port)
const server = http.createServer(app);

server.listen(config.loadBalancer.port);

server.on('error', error => {
    if (error.syscall !== 'listen') {
        throw error
    }
    const bind = `${typeof(config.loadBalancer.port) === 'string' ? 'Pipe' : 'Port'} ${config.loadBalancer.port}`;
    logServer(bind);
    logServer(error.code);
    logServer(error.stack);
    process.exit(1);
});

server.on('listening', () => {
    const addr = server.address();
    const bind = typeof(addr) === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
    logServer(`Listening on ${bind}`);
});

server.on('upgrade', proxy.ws);
