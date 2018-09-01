#!/usr/bin/env node

const express = require('express');
const routes = require('./routes/routes');
const loadConfig = require('./utils/config');

const config = loadConfig();
const app = express();

app.use((req, res, next) => {
    const method = req.method && req.method.toUpperCase && req.method.toUpperCase();
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers']);
        res.statusCode = 204;
        res.setHeader('Content-Length', '0');
        res.end();
    } else {
        next();
    }
});

app.use('/api/sessions', express.static(config.plex.sessions));
app.use('/', routes(config));

app.listen(config.loadBalancer.port,
    () => console.log(`Listening on port ${config.loadBalancer.port}`));
