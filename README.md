## RhinoLoadBalancer

This software is a **heavily modified** version the of __UnicornTranscoder__ project, it's the LoadBalancer that will catch Plex requests and send them to a __UnicornTranscoder__.

## Origional UnicornTranscoder Project

* [UnicornTranscoder](https://github.com/UnicornTranscoder/UnicornTranscoder)
* [UnicornLoadBalancer](https://github.com/UnicornTranscoder/UnicornLoadBalancer)
* [UnicornFFMPEG](https://github.com/UnicornTranscoder/UnicornFFMPEG)

## Dependencies

* Plex Media Server
* NodeJS
* yarn

## Setup

### 1. Installation

1. Clone the repository
2. Install with `yarn`
3. Create the configuration in a file called `config.json`. See `config.example.json` for details on config items.
4. Configure Plex Media Server access Address
  * In Settings -> Server -> Network
  * Set `Custom server access URLs` to the address to access the UnicornLoadBalancer
5. Run with `yarn start`

## 2. Notes

All the requests to this Plex Media Server should pass by the RhinoLoadBalancer, if someone reach the server directly without passing through RhinoLoadBalancer he will not be able to start a stream, since FFMPEG binary has been replaced. It is recomended to setup a nginx reverse proxy in front to setup a SSL certificate and to have an iptable to direct access to the users on port 32400.

```
#Example iptable
#Allow transcoders to reach the Plex Media Server
iptables -A INPUT -p tcp --dport 32400 -i eth0 -s <transcoderIP> -j ACCEPT
#Deny all other incoming connections
iptables -A INPUT -p tcp --dport 32400 -i eth0 -j DROP
```

