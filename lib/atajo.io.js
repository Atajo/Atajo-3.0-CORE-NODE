'use strict'

const redis = require('socket.io-redis');
const express = require('express');

class IO {

    constructor(insights) {

        this.insights = insights; 
        return this;

    }

    listen(port) {

        const app = express();
        const server = require('http').createServer(app);
        server.listen(port);

        //START HEALTH
        this.configureHealthCheck(app);

        //START SOCKET
        this.io = require('socket.io')(server, {
            serveClient: false,
            path: '/socket.io',
            pingTimeout: 60000,
            pingInterval: 25000,
            maxHttpBufferSize: 20E7,
            //transports: ['websocket'],
            allowUpgrades: true,
            perMessageDeflate: {
                threshold: 1024
            },
            httpCompression: {
                threshold: 1024
            },
            wsEngine : "uws"
        });

        let redisConfig = config.get("REDIS");
        log.debug("IO:ATTACHING REDIS : ", redisConfig);

        if (redisConfig.key) {
            //USE CLOUD PROVIDER
            var pub = require('redis').createClient(redisConfig.port, redisConfig.host, {
                auth_pass: redisConfig.key,
                return_buffers: true,
                tls: {
                    servername: redisConfig.host
                }
            });
            var sub = require('redis').createClient(redisConfig.port, redisConfig.host, {
                auth_pass: redisConfig.key,
                return_buffers: true,
                tls: {
                    servername: redisConfig.host
                }
            });

            this.redis = this
                .io
                .adapter(redis({pubClient: pub, subClient: sub}));
            this
                .redis
                .on('error', (e) => {
                    this.insights.trackEvent({name: "atajo.core.redis.error", properties: { error: e}});
                    log.error("COULD NOT CONNECT TO REDIS");
                    process.exit(1)

                });

            this
                .redis
                .on('connect', (e) => {

                    log.error("CONNECTED TO REDIS @ ", redisConfig);

                });

        } else {
            //USE LOCAL
            this.redis = this
                .io
                .adapter(redis(redisConfig));
            this
                .redis
                .on('error', function (e) {
                    this.insights.trackEvent({name: "atajo.core.redis.error", properties: { error: e}});
                    log.error("COULD NOT CONNECT TO REDIS");
                    //process.exit(1)
                });
        }

        return this.io;

    }

    configureHealthCheck(app) {

        log.debug("STARTING HEALTHCHECK");

        app.get('/health', (req, res)  => {
            this.insights.trackEvent({name: "atajo.core.healthcheck"});
            log.debug("HEALTHCHECK REQUEST");
            res.send('ALIVE');
        })

    }

    configureControls(app) {

        log.debug("STARTING CONTROLS");

    }

}

module.exports = IO;