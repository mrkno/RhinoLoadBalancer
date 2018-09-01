## RhinoLoadBalancer

This is a transcoding Load Balancer for Plex, similar to what is used for Plex Cloud. Unlike the Plex distributed transcoder project, each transcoding node used by this load balancer directly serves the client reducing load on the Plex server itself.

This is a __heavily modified__ fork the of [UnicornLoadBalancer](https://github.com/UnicornTranscoder/UnicornLoadBalancer), with the aim of improving its dynamic scaling abilities.

## Dependencies

* Plex Media Server
* Ngnix
* NodeJS (with yarn or npm)

## Setup

1. Clone the repository
2. Install with `yarn` or `npm install`
3. Create the configuration in a file called `config.json`. See `config.example.json` for config items.
4. Create a Ngnix configuration. See `ngnix.example.conf` for a working configuration.
5. Configure Plex Media Server access Address
  * In Settings -> Server -> Network
  * Set `Custom server access URLs` to the address to access the configured Ngnix endpoint
5. Run with `yarn start`, `npm start` or `node ./src/main.js`
6. Install and setup `RhinoTranscoder` nodes to automatically join the cluster