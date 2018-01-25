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

        let redisConfig = config.get("REDIS");
        log.debug("IO:ATTACHING REDIS : ", redisConfig);


        if (redisConfig.key) {
            //USE CLOUD PROVIDER
            var pub = require('redis').createClient(redisConfig.port, redisConfig.host, { auth_pass: redisConfig.key, return_buffers: true, tls: { servername: redisConfig.host } });
            var sub = require('redis').createClient(redisConfig.port, redisConfig.host, { auth_pass: redisConfig.key, return_buffers: true, tls: { servername: redisConfig.host } });

            this.redis = this.io.adapter(redis({ pubClient: pub, subClient: sub }));
            this.redis.on('error', (e) => {

                log.error("COULD NOT CONNECT TO REDIS");
                process.exit(1)

            });

            this.redis.on('connect', (e) => {

                log.error("CONNECTED TO REDIS @ ", redisConfig);

            });

        } else {
            //USE LOCAL
            this.redis = this.io.adapter(redis(redisConfig));
            this.redis.on('error', function(e) {

                log.error("COULD NOT CONNECT TO REDIS");
                //process.exit(1)

            });

        }


        return this.io;

    }


}


module.exports = IO;