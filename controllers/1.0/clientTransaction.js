var Response = require('../../lib/atajo.response');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
class Transaction {

    constructor(firewall) {

        this.response = new Response();
        this.firewall = firewall;
        this.cachePath = config
            .get("CACHE")
            .path;
        return this;
    }

    tx(socket, tx) {

        log.debug("CLIENT:TX -> ", tx);
        var that = this;

        let domain = tx.domain;
        let device = tx.payload.device;
        let uuid = device
            .uuid
            .toLowerCase();
        let pid = tx.payload.pid;
        let latency = tx.latency;
        let lambda = tx.lambda;
        let version = tx.version;
        let destinationDomain = '';

        if (device && socket.request.headers) {
            let remoteIpAddress = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
            device.ip = device.ip
                ? device.ip
                : remoteIpAddress
        }

        log.debug("REMOTE ADDRESS IS : ", device.ip);

        if (lambda.indexOf('@') > -1 && lambda.indexOf('/') > -1) {

            let preDomain = lambda.split('/');
            destinationDomain = preDomain[0].replace('@', '');
            lambda = preDomain
                .slice(1)
                .join("/");
            log.info("@ LAMBDA REQUEST DETECTED : @" + destinationDomain + "/" + lambda + " FROM : " + domain);

        } else {
            destinationDomain = domain;
        }

        dbi
            .clientConnectionStates
            .findOne({uuid: uuid, domain: domain})
            .then(client => {
                log.debug("CLIENT:TX CLIENT IS ", client);

                if (client) {

                    client.device.battery = device.battery;
                    client.device.signal = device.signal;
                    client.device.network = device.network;
                    client.device.ip = device.ip;
                    client.save();

                } else {
                    log.warn("NO CLIENT FOUND FOR TX");
                }

                dbi
                    .transactions
                    .findOne({pid: pid})
                    .then((transaction) => {
                        /*
                                if (err) {
                                    log.error("ERROR FINDING PID : ", err);
                                    socket.emit('client:rx', that.response.error(pid, "Error Processing Transaction " + err));
                                    return;
                                }
                */
                        if (!transaction) {

                            log.debug("CLIENT:TX TX DOES NOT EXIST FOR PID : ", pid);

                            that
                                .firewall
                                .getProviderNode(destinationDomain, id => {

                                    if (id) {

                                        try {
                                            tx.payload.data.device = tx.payload.device
                                        } catch (e) {
                                            log.warn("COULD NOT ADD DEVICE DETAILS TO PAYLOAD : ", e);
                                        }

                                        //CACHE REQUEST
                                        let cacheFile = path.join(that.cachePath, "request_" + pid + '.json')
                                        fs.writeFile(cacheFile, JSON.stringify(tx.payload.data), (err) => {

                                            if (err) {
                                                log.warn("COULD NOT CACHE REQUEST PAYLOAD : ", err);
                                            }

                                        }); 

                                            var newTX = {

                                                domain: domain,
                                                destinationDomain: destinationDomain,
                                                lambda: lambda,
                                                uuid: uuid,
                                                status: 'BUSY',
                                                pid: pid,
                                                latency: latency,
                                                request: cacheFile,
                                                version: version,
                                                environment: tx.environment

                                            }

                                            new dbi
                                                .transactions(newTX)
                                                .save()
                                                .then(() => {

                                                    log.debug("EMITTING TO LAMBDA - CLIENT:TX ON " + id, newTX);

                                                    newTX.request = tx.payload.data;
                                                    io
                                                        .to(id)
                                                        .emit('client:tx', newTX);

                                                })
                                                .catch(err => {

                                                    log.error("ERROR SAVING TX : ", newTX, err);

                                                    newTX.request = tx.payload.data;
                                                    io
                                                        .to(id)
                                                        .emit('client:tx', newTX);

                                                })

                                    

                                    } else {
                                        log.warn("COULD NOT SUBMIT TX TO LAMBDA -> LAMBDA NOT CONNECTED");
                                        socket.emit('client:rx', that.response.error(pid, "No lambdas available for " + destinationDomain));
                                    }

                                });

                        } else {

                            log.debug("CLIENT:TX TX EXISTS FOR PID : ", pid);

                            //RESPOND TO WITH DEVICE TX STATE
                            if (transaction.status == "DONE") {
                                log.debug("CLIENT:TX TX STATUS IS DONE FOR PID : ", pid);
                                delete transaction.request;
                                let response = '';
                                try {
                                    let responseElement = transaction.responses[transaction.responses.length - 1];

                                    response = {
                                        error: responseElement.error,
                                        latency: transaction.latency,
                                        pid: transaction.pid,
                                        response: responseElement.response
                                    }

                                    socket.emit('client:rx', response);

                                } catch (e) {

                                    log.warn("COULD NOT BUILD DONE ECHO RESPONSE : ", e);

                                }

                            } else if (transaction.status == "FAILED") {

                                log.debug("CLIENT:TX TX STATUS IS FAILED FOR PID : " + pid + " --> RETRYING");
                                that
                                    .firewall
                                    .getProviderNode(destinationDomain, id => {
                                        if (id) {
                                            transaction.status = "BUSY";
                                            transaction.save();

                                            const requestFile = path.join(that.cachePath, 'request_' + transaction.pid + '.json'); 
                                            log.debug("FETCHING REQUEST FILE @ ", requestFile);
 
                                            fs.readFile(requestFile, 'utf-8', (err, result) => {

                                                if(err) { 
                                                    socket.emit('client:rx', that.response.error(pid, "Could not find cached request for pid " + transaction.pid ));
                                                    return; 
                                                }

                                                transaction.request = JSON.parse(result);
                                                log.debug("EMITTING TO LAMBDA - CLIENT:TX ON " + id, transaction);
                                                io
                                                    .to(id)
                                                    .emit('client:tx', transaction);

                                            });

                                        } else {
                                            socket.emit('client:rx', that.response.error(pid, "No lambdas available for " + destinationDomain));
                                        }

                                    });

                                //CHUNK REQUEST (TX NOT DONE) EMIT THE REQUEST TO PROVIDER

                            } else if (transaction.status == "BUSY") {

                                log.debug("CLIENT:TX TX STATUS IS BUSY FOR PID : ", pid);

                                /* that
                                    .firewall
                                    .getProviderNode(destinationDomain, id => {
                                        if (id) {
                                            log.debug("EMITTING TO LAMBDA - CLIENT:TX ON " + id, transaction);
                                            io
                                                .to(id)
                                                .emit('client:tx', transaction);
                                        } else {
                                            socket.emit('client:rx', that.response.error(pid, "No lambdas available for " + destinationDomain));
                                        }

                                    }); */

                                //CHUNK REQUEST (TX NOT DONE) EMIT THE REQUEST TO PROVIDER

                            } else {

                                log.debug("CLIENT:TX TX STATUS IS NOT DONE OR BUSY FOR PID : ", pid, transaction.status);
                                socket.emit('client:rx', that.response.error(pid, {status: transaction.status}));
                            }

                        }

                    })
                    .catch(error => {

                        log.error("COULD NOT GET PID (DROPPING) : ", error);

                    })

            })
            .catch(error => {

                log.error("FATAL ERROR : ", error);

            });

    }

    rx(socket, rx) {

        log.debug("CLIENT:RX -> ", rx);

        var that = this;
        let pid = rx.pid;

        dbi
            .transactions
            .findOne({pid: pid})
            .then(transaction => {

                //log.debug("TRANSACTION IS : ", transaction);

                if (rx.response.chunkTotal > 1) {
                    transaction.status = "BUSY";
                } else if (rx.error) {
                    transaction.status = "FAILED";
                } else {
                    transaction.status = "DONE";
                }

                let cacheFile = path.join(that.cachePath, "response_" + pid + '.json'); 
                fs.writeFile(cacheFile, JSON.stringify(rx), (err) => {

                    if (err) {
                        log.warn("ERROR SAVING RESPONSE FOR (%a) : %b", pid, err);
                    }
                }); 

                    transaction.latency = rx.latency;
                    delete rx.latency;
                    transaction
                        .responses
                        .push(cacheFile);

                    let response = {
                        error: rx.error,
                        latency: transaction.latency,
                        pid: pid,
                        response: rx.response
                    }

                    transaction.lastDeviceResponse = response;

                    

                    transaction
                        .save()
                        .then(() => {

                            //log.debug("TRANSACTION IS NOW : ", transaction); GET THE CLIENT SOCKET

                        })
                        .catch(err => {

                            log.error("ERROR SAVING RX: ", err, transaction);

                            // IF ITS BSON ERROR -> DUMP TO DISK AND CONTINUE if (err.indexOf('RangeError')
                            // > -1) {     log.error("MONGO THREW RANGE ERROR -> RESPONSE TOO LARGE ->
                            // TODO: DUMP TO DISK"); }

                        })

                      this
                        .firewall
                        .getClientId(transaction.uuid, transaction.domain, id => {

                            if (id) {
                                log.debug("EMITTING TO DEVICE - CLIENT:RX", response);
                                io
                                    .to(id)
                                    .emit('client:rx', response);
                            }

                        });

                

            })
            .catch(err => {

                log.error("CLIENT:RX ERROR", err);

            })

    }
}

module.exports = Transaction;