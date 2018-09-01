#!/usr/bin/env node

const express = require('express');
const expressWs = require('express-ws');
const corsMiddleware = require('./core/corsMiddleware');
const rhinoRoutes = require('./routes/rhinoRoutes');
const plexRoutes = require('./routes/plexRoutes');
const loadConfig = require('./utils/config');
const ServerManager = require('./core/serverManager');
const TranscoderServers = require('./core/transcoderServers');

const config = loadConfig();
const transcoderServers = new TranscoderServers();
const serverManager = new ServerManager(transcoderServers);
const app = expressWs(express());

app.use(corsMiddleware);

app.use('/rhino', rhinoRoutes(config, app, transcoderServers));
app.use('/', plexRoutes(config, serverManager));

app.listen(config.loadBalancer.port,
    () => console.log(`Listening on port ${config.loadBalancer.port}`));
