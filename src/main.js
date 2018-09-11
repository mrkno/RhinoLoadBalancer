#!/usr/bin/env node

const http = require('http');
const morgan = require('morgan');
const express = require('express');
const socketio = require('socket.io');
const corsMiddleware = require('./core/corsMiddleware');
const rhinoRoutes = require('./routes/rhinoRoutes');
const plexRoutes = require('./routes/plexRoutes');
const loadConfig = require('./utils/config');
const ServerManager = require('./core/serverManager');
const TranscoderServers = require('./core/transcoderServers');

const config = loadConfig();
const transcoderServers = new TranscoderServers();
const serverManager = new ServerManager(transcoderServers);
const app = express();
const server = http.Server(app);
const io = socketio(server, {
    path: '/rhino/comms'
});

app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
app.use(corsMiddleware);

app.use('/rhino', rhinoRoutes(config, io, transcoderServers));
app.use('/', plexRoutes(config, serverManager));

server.listen(config.loadBalancer.port,
    () => console.log(`Listening on port ${config.loadBalancer.port}`));
