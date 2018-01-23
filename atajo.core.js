'use strict'

//REMOTE DEPENDENCIES
const os = require('os');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

//LOCAL DEPENDENCIES
const IO = require('./lib/atajo.io');
const Log = require('./lib/atajo.log');
const Firewall = require('./lib/atajo.firewall');
const DBI = require('./dbi')

global.config = require('./config');
global.log = null;
global.release = null;
global.apiResponse = {};
var instance = null;
var firewall = null;


class Core {


    constructor(id, corePort, release) {

        this.port = corePort;
        global.release = release;

        log = new Log(release, config.get("LOGPATH") || path.join(__dirname, 'logs', 'node_' + id + '_' + corePort));

        global.firewall = this.firewall = new Firewall().start();

        return this;
    }

    start() {

        var _ = this;

        log.debug("CORE:STARTING " + release.toUpperCase() + " ON " + _.port);

        let mongoConnectionString = config.get('MONGO')[release].host;
        log.debug("CORE:CONNECTING TO DATABASE @ ", mongoConnectionString);

        new DBI().init().then(dbi => {

            dbi.connect(mongoConnectionString).then(schemas => {

                global.dbi = schemas;

                log.debug("MONGO:CONNECTED");

                global.io = new IO().listen(_.port);
                io.sockets.on('connection', (socket => { _.processConnection(socket); }));



            }).catch(error => {

                log.error("CORE:STARTUP ERROR : ", error);
                process.exit(1);

            })



        }).catch(error => {

            log.error("MONGO:ERROR : ", error);
            process.exit(1);

        })




    }

    processConnection(socket) {

        var that = this;

        this.firewall.clear(socket).then((domain) => {


            //add events
            socket.on('disconnect', () => {

                that.firewall.disconnect(socket);
                log.debug("SOCKET DISCONNECTED : " + socket.id);


            });

            socket.on('core:tx', tx => {});
            socket.on('core:rx', rx => {});

            socket.on('domain:status', data => {
                let domain = socket.domain || data.domain;
                that.firewall.getProviderStatus(domain, nodeCount => {
                    socket.emit('domain:status', { nodes: nodeCount })
                });
            });

            socket.on('client:tx', tx => {

                try {
                    let Controller = require('./controllers/' + tx.version + '/clientTransaction');
                    let controller = new Controller(that.firewall).tx(socket, this.processLatency(tx, 'tx'));
                } catch (e) {
                    log.error("CLIENT:TX:TRANSACTION ERROR ", e.stack);
                }

            });

            socket.on('client:rx', rx => {

                try {
                    let Controller = require('./controllers/' + rx.version + '/clientTransaction');
                    let controller = new Controller(that.firewall).rx(socket, this.processLatency(rx, 'rx'));
                } catch (e) {
                    log.error("CLIENT:RX:TRANSACTION ERROR ", e.stack);
                }

            });


            socket.on('lambda:tx', tx => {

                try {
                    let Controller = require('./controllers/' + tx.version + '/lambdaTransaction');
                    let controller = new Controller(that.firewall).tx(socket, this.processLatency(tx, 'tx'));
                } catch (e) {
                    log.error("LAMBDA:RX:TRANSACTION ERROR ", e.stack);
                }

            });

            //TO LAMBDA
            socket.on('lambda:rx', rx => {

                try {
                    let Controller = require('./controllers/' + rx.version + '/lambdaTransaction');
                    let controller = new Controller(that.firewall).rx(socket, this.processLatency(rx, 'rx'));
                } catch (e) {
                    log.error("LAMBDA:RX:TRANSACTION ERROR ", e.stack);
                }

            });


            //API
            socket.on('lambda:definition', def => {

                try {

                    let id = socket.identity;
                    log.debug("GOT LAMBDA DEFINITION FOR " + id.domain);

                    let definitionPath = path.join(__dirname, 'api', 'docs', id.domain + '.yaml');
                    fs.writeFile(definitionPath, def, (err) => {

                        if (err) {
                            log.debug("COULD NOT SAVE DEFINITION : ", err);
                        } else {
                            log.debug("DEFINITION SAVED");
                            //DO SOME SANITY CHECKS..

                            //ADD THE API NODE
                            // this.api.add(id.domain);

                        }



                    })
                } catch (e) {
                    log.error("LAMBDA:DEFINITION", e.stack);
                }

            });

            socket.on('api:rx', rx => {

                try {
                    let Controller = require('./api/controllers/apiResponse');
                    let controller = new Controller(that.firewall).response(socket, this.processLatency(rx, 'rx'));
                } catch (e) {
                    log.error("API:RX:TRANSACTION ERROR ", e.stack);
                }

            });





            //DEPRECATE
            socket.on('provider:tx', rx => {
                log.warn("DEPRECATED EVENT (provider:tx) CALLED");
                try {
                    let Controller = require('./controllers/' + rx.version + '/clientTransaction');
                    let controller = new Controller(that.firewall).rx(socket, this.processLatency(rx, 'rx'));
                } catch (e) {
                    log.error("PROVIDER:TX:TRANSACTION ERROR ", e.stack);
                }

            });
            socket.on('provider:status', data => {
                log.warn("DEPRECATED EVENT (provider:status) CALLED");
                let domain = socket.domain || data.domain;
                that.firewall.getProviderStatus(domain, nodeCount => {
                    socket.emit('provider:status', { nodes: nodeCount })
                });
            });
            //DEPRECATE




        }).catch(response => {

            //log.warn("FIREWALL BLOCKED CONNECTION ATTEMPT : ", response);

        });






    }

    processLatency(obj, type) {

        if (obj) {
            if (type == 'rx') {
                obj.latency.coreLambdaResponseAt = new Date().getTime();
            } else {
                obj.latency.coreLambdaRequestAt = new Date().getTime();
            }
        }

        return obj;

    }




}



//CLI
if (!process.send) {

    let release = process.argv[2] || 'dev';
    let corePort = process.argv[3] || '80';
    let instance = new Core(0, corePort, release).start();


}

//FORKED
process.on('message', function(data) {

    console.log("forked process");

});