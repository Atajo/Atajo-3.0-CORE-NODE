'use strict'

const redis = require('socket.io-redis');


class IO {

    constructor() {

        return this;

    }


    listen(port) {

        this.io = require('socket.io')(port, {
            serveClient: true,
            path: '/socket.io',
            pingTimeout: 60000,
            pingInterval: 25000,
            maxHttpBufferSize: 10E7,
            // transports: ['websocket'],
            allowUpgrades: true,
            perMessageDeflate: {
                threshold: 1024
            },
            httpCompression: {
                threshold: 1024
            },
            cookie: false,
            cookiePath: false,
            wsEngine: 'uws'
        });

        this.io.engine.ws = new(require('uws').Server)({
            noServer: true,
            perMessageDeflate: false
        });

        let redisUri = config.get("REDIS")[release];
        log.debug("IO:ATTACHING REDIS : ", redisUri)
        this.redis = this.io.adapter(redis(redisUri));
        this.redis.on('error', function(e) {

            log.error("COULD NOT CONNECT TO REDIS");
            //process.exit(1)

        });


        return this.io;

    }


}


module.exports = IO;