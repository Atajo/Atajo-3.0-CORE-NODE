var Response = require('../../lib/atajo.response');

class Transaction {

    constructor(firewall) {

        this.response = new Response();
        this.firewall = firewall;
        return this;
    }

    tx(socket, tx) {

        log.debug("LAMBDA:TX -> ", tx);

        let domain = tx.domain;
        let device = tx.payload.device;
        let uuid = device.uuid.toLowerCase();
        let pid = tx.payload.pid;
        let latency = tx.latency;
        let lambda = tx.lambda;
        let version = tx.version;
        let destinationDomain = '';

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

        dbi.transactions.findOne({ pid: pid }).then(exists => {

            if (!exists) {

                this.firewall.getProviderNode(destinationDomain, id => {

                    if (id) {

                        var newTX = {

                            domain: domain,
                            destinationDomain: destinationDomain,
                            lambda: lambda,
                            uuid: uuid,
                            status: 'QUEUED',
                            pid: pid,
                            latency: latency,
                            request: tx.payload.data,
                            version: version,
                            environment: tx.environment

                        }

                        new dbi.transactions(newTX).save();
                        log.debug("EMITTING TO LAMBDA:TX ON " + id, newTX);
                        io.to(id).emit('lambda:tx', newTX);

                    } else {
                        log.warn("COULD NOT SUBMIT TX TO LAMBDA -> LAMBDA NOT CONNECTED");
                        socket.emit('lambda:rx', this.response.error(pid, "No lambdas available for " + destinationDomain));
                    }

                });



            } else {

                //RESPOND TO LAMBDA WITH TX STATE
                if (tx.status == "DONE") {
                    delete tx.request;
                    socket.emit('lambda:rx', that.response.success(pid, tx));
                } else if (tx.status == "BUSY") {

                    //CHUNK REQUEST (TX NOT DONE) EMIT THE REQUEST TO PROVIDER

                } else {
                    socket.emit('lambda:rx', that.response.error(pid, { status: tx.status }));
                }


            }

        }).catch(error => {

            log.error("COULD NOT GET PID (DROPPING) : ", error);

        })






    }

    rx(socket, rx) {

        log.debug("LAMBDA:RX -> ", rx);

        var that = this;
        let pid = rx.pid;


        dbi.transactions.findOne({ pid: pid }).then(transaction => {

            //log.debug("TRANSACTION IS : ", transaction);

            if (rx.response.chunkTotal > 1) {
                transaction.status = "BUSY";
            } else {
                transaction.status = "DONE";
            }

            transaction.latency = rx.latency;
            delete rx.latency;
            transaction.responses.push(rx);

            let response = {
                error: rx.error,
                latency: transaction.latency,
                pid: pid,
                response: rx.response
            }

            transaction.lastDeviceResponse = response;
            transaction.save();

            log.debug("TRANSACTION IS : ", transaction);

            //GET THE LAMBDA SOCKET

            console.log("SEND RESPONSE (LAMBDA:RX) TO LAMBDA");

            this.firewall.getProviderNode(transaction.domain, id => {

                if (id) {
                    log.debug("EMITTING LAMBDA:RX", response);
                    io.to(id).emit('lambda:rx', response);
                } else {
                    log.warn("LAMBDA:RX COULD NOT FIND NODE FOR " + transaction.domain);
                }


            });




        }).catch(err => {

            log.error("LAMBDA:RX ERROR", err);

        })


    }


}

module.exports = Transaction;