const Consul = require('../lib/atajo.consul');
const guid = require('uuid/v4');
const kvDomains = 'mobility/domains/';

class Firewall {

    constructor(appInsights) {

        this.insights = appInsights.defaultClient;

        this.providers = {};
        this.hooks = {
            lambda: {
                disconnect: {},
                connect: {}
            },
            client: {
                disconnect: {},
                connect: {}
            }
        }

        return this;

    }

    registerHook(id, type, event, callback) {

        try {
            this.hooks[type][event][id] = callback;
        } catch (e) {
            log.error("COULD NOT ADD HOOK FOR " + type + " / " + event + " : ", e);
        }

    }

    removeHook(id, type, event) {

        try {
            delete this.hooks[type][event][id];
        } catch (e) {
            log.error("COULD NOT REMOVE HOOK FOR " + type + " / " + event + " : ", e);
        }

    }

    triggerHook(type, event, data) {

        try {
            for (var i in this.hooks[type][event]) {

                log.debug("FIREWALL:HOOK:TRIGGER - " + i);
                this.hooks[type][event][i](data);

            }
        } catch (e) {
            log.error("COULD NOT TRIGGER HOOK FOR " + type + " / " + event + " : ", e);
        }

    }

    start() {

        this
            .insights
            .trackEvent({name: "atajo.core.firewall.start"});


        this.consul = new Consul()
            .start()
            .subscribe(response => {
                if (response.key == 'mobility/core/providers') {
                    this.providers = response.value;
                    /*for (let i in this.providers) {
                        log.debug("ACL UPDATE : " + i + " => ", this.providers[i])
                    }*/
                }
            }, error => {

                log.error("FIREWALL UPDATE ERROR : ", error);
                this
                    .insights
                    .trackEvent({
                        name: "atajo.core.firewall.consul.error",
                        properties: {
                            error: error
                        }
                    });
            }, () => {});

        return this;

    }

    clear(socket) {

        var that = this;

        return new Promise((resolve, reject) => {

            let remoteIpAddress = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;

            try {

                let query = socket.handshake.query;
                log.debug("SOCKET CLEAR REQUEST FROM : " + remoteIpAddress + " / ", query);

                let isProvider = query.hostname;
                let uuid = (isProvider)
                    ? query
                        .hostname
                        .toLowerCase()
                    : query
                        .uuid
                        .toLowerCase();
                let key = (isProvider)
                    ? query
                        .secret
                        .toLowerCase()
                    : query
                        .key
                        .toLowerCase();
                let domain = query
                    .domain
                    .toLowerCase();

                log.debug("DOMAIN IS : ", domain)
                let device = (isProvider)
                    ? {}
                    : query.device;
                let acl = this.providers[domain];

                try {
                    if (!isProvider) {
                        device = JSON.parse(device);
                    }
                } catch (e) {
                    log.warn("FIREWALL: DEVICE DID NOT IDENTIFY ITSELF PROPERLY -> REJECTING");
                    this
                        .insights
                        .trackEvent({
                            name: "atajo.core.firewall.reject",
                            properties: {
                                domain: domain,
                                error: e.stack
                            }
                        });

                    socket.emit("core:message", {
                        disconnect: true,
                        message: "INVALID DOMAIN / SECRET"
                    });
                    return;
                }

                if (!acl) {
                    log.warn("FIREWALL: INVALID DOMAIN FOR " + key + " @ " + domain);
                    this
                        .insights
                        .trackEvent({
                            name: "atajo.core.firewall.reject",
                            properties: {
                                domain: domain,
                                error: "FIREWALL: INVALID DOMAIN FOR " + key + " @ " + domain
                            }
                        });

                    socket.emit("core:message", {
                        disconnect: true,
                        message: "INVALID DOMAIN / SECRET - IF THIS IS A NEW DOMAIN - PLEASE TRY CONNECT AGAIN"
                    });

                    //FORCE REFRESH
                    this
                        .consul
                        .process();

                    return;
                }

                let matchKey = (isProvider)
                    ? acl.secret
                    : acl.key;

                let update = {
                    uuid: uuid,
                    key: key,
                    domain: domain,
                    ip: remoteIpAddress
                };

                if (domain && (matchKey == key)) {

                    log.debug("VALID " + (isProvider
                        ? "PROVIDER"
                        : "DEVICE") + " CONNECTED WITH " + key + " @ " + domain);
                    update.valid = true;
                    update.state = "CONNECTED";

                    if (isProvider) {
                        new dbi
                            .providerConnectionLogs(update)
                            .save()

                    } else {
                        new dbi
                            .clientConnectionLogs(update)
                            .save()

                    };

                    delete update.valid;
                    delete update.state;

                    update.connected = true;
                    update.id = socket.id;
                    update.device = device;

                    //console.log(update);

                    if (isProvider) {
                        socket.identity = {
                            pid: guid(),
                            uuid: uuid,
                            domain: domain,
                            key: key,
                            ip: remoteIpAddress,
                            provider: true,
                            device: device
                        };

                        io
                            . in(domain + '_provider')
                            .clients((err, clients) => {

                                if (clients.length == 0) {
                                    //FIRST CONNECTION. FAIL BUSY
                                    this
                                        .insights
                                        .trackEvent({
                                            name: "atajo.core.firewall.lambda.connect",
                                            properties: {
                                                domain: socket.identity.domain,
                                                uuid: socket.identity.uuid,
                                                ip: socket.identity.ip
                                            }
                                        });

                                    log.debug("FIRST CONNECT: SETTING ALL BUSY TRANSACTIONS FOR DOMAIN " + domain + " TO FAILED");
                                    dbi
                                        .transactions
                                        .updateOne({
                                            domain: domain,
                                            status: 'BUSY'
                                        }, {
                                            $set: {
                                                status: 'FAILED'
                                            }
                                        })
                                        .then(err => {

                                            log.debug("FIRST CONNECT: SET ALL BUSY TRANSACTIONS FOR DOMAIN " + domain + " TO FAILED");

                                        })
                                }

                                socket.join(domain + '_provider');

                                log.debug((clients.length + 1) + " PROVIDER NODES IN " + domain);
                                update.nodes = clients.length;
                                dbi
                                    .providerConnectionStates
                                    .findOneAndUpdate({
                                        domain: domain
                                    }, update, {
                                        upsert: true
                                    }, (err, obj) => {

                                        io
                                            .to(domain)
                                            .emit('domain:connect', {nodes: clients.length});

                                        resolve(domain);

                                    });

                            });

                    } else {
                        socket.identity = {
                            pid: guid(),
                            uuid: uuid,
                            domain: domain,
                            key: key,
                            ip: remoteIpAddress,
                            provider: false,
                            device: device
                        };
                        socket.join(domain);

                        let trackingObj = {
                            domain: socket.identity.domain,
                            uuid: socket.identity.uuid,
                            ip: socket.identity.ip
                        }

                        if (socket.identity.device) {

                            for (let i in socket.identity.device) {
                                trackingObj[i] = ((!!socket.identity.device[i]) && (socket.identity.device[i].constructor === Object))
                                    ? JSON.stringify(socket.identity.device[i])
                                    : socket.identity.device[i]
                            }

                        }

                        this
                            .insights
                            .trackEvent({name: "atajo.core.firewall.client.connect", properties: trackingObj});

                        log.debug("UPDATING CLIENT CONNECTION STATES UUID " + uuid + " WITH ", update);

                        dbi
                            .clientConnectionStates
                            .findOneAndUpdate({
                                uuid: uuid
                            }, update, {
                                upsert: true
                            }, (err, obj) => {});
                        that.getProviderNode(domain, function (id) {

                            resolve(domain);

                            io
                                .to(id)
                                .emit('client:connect', socket.identity);

                        });
                    }

                } else {

                    log.warn("FIREWALL: INVALID CONNECTION FOR " + key + " @ " + domain);
                    this
                        .insights
                        .trackEvent({
                            name: "atajo.core.firewall.reject",
                            properties: {
                                domain: domain,
                                key: key
                            }
                        });

                    update.valid = false;

                    if (isProvider) {
                        new dbi
                            .providerConnectionLogs(update)
                            .save()
                    } else {
                        new dbi
                            .clientConnectionLogs(update)
                            .save()
                    };
                    socket.disconnect(update.reason);
                    reject(update);

                }

            } catch (e) {

                log.warn("FIREWALL:ERROR : ", e);
                this
                    .insights
                    .trackEvent({
                        name: "atajo.core.firewall.error",
                        properties: {
                            error: e
                        }
                    });
                reject();

            }

        });

    }

    disconnect(socket) {

        var that = this;

        log.debug("ID IS ", socket.identity);

        let identity = socket.identity;
        let domain = identity.domain;

        if (identity.provider) {

            log.debug("A PROVIDER NODE ON " + identity.domain + " DISCONNECTED!");
            io
                . in(domain + '_provider')
                .clients((err, clients) => {

                    log.debug(clients.length + " PROVIDER NODES IN " + domain);
                    if (clients.length == 0) {

                        let trackingObj = {
                            domain: identity.domain,
                            uuid: identity.uuid,
                            ip: identity.ip
                        }

                        this
                            .insights
                            .trackEvent({name: "atajo.core.firewall.lambda.disconnect", properties: trackingObj});

                        new dbi
                            .providerConnectionLogs({
                            domain: identity.domain,
                            key: identity.key,
                            uuid: identity.uuid,
                            state: 'DISCONNECTED',
                            ip: identity.ip,
                            valid: true
                        })
                            .save();

                        log.debug("LAST DISCONNECT: SETTING BUSY TRANSACTIONS FOR DOMAIN " + identity.domain + " TO FAILED");
                        dbi
                            .transactions
                            .updateOne({
                                domain: identity.domain,
                                status: 'BUSY'
                            }, {
                                $set: {
                                    status: 'FAILED'
                                }
                            })
                            .then(err => {

                                log.debug("LAST DISCONNECT: SET ALL BUSY TRANSACTIONS FOR DOMAIN " + identity.domain + " TO FAILED");

                            })

                    }

                    let connected = (clients.length == 0)
                        ? false
                        : true;
                    let update = {
                        nodes: clients.length,
                        connected: connected
                    }
                    io
                        .to(domain)
                        .emit('domain:disconnect', {nodes: clients.length});
                    dbi
                        .providerConnectionStates
                        .findOneAndUpdate({
                            domain: identity.domain
                        }, update, {
                            upsert: true
                        }, (err, obj) => {});
                    this.triggerHook('lambda', 'disconnect', {
                        domain: domain,
                        identity: identity,
                        status: update
                    });

                });

        } else {

            log.debug("A DEVICE ON " + identity.domain + " DISCONNECTED!");

            let trackingObj = {
                domain: identity.domain,
                uuid: identity.uuid,
                ip: identity.ip
            }

            if (identity.device) {
                for (let i in identity.device) {
                    trackingObj[i] = ((!!identity.device[i]) && (identity.device[i].constructor === Object))
                        ? JSON.stringify(identity.device[i])
                        : identity.device[i]
                }
            }

            this
                .insights
                .trackEvent({name: "atajo.core.firewall.client.disconnect", properties: trackingObj});

            that.getProviderNode(domain, function (id) {

                io
                    .to(id)
                    .emit('client:disconnect', identity);

            });

            this.triggerHook('client', 'disconnect', {domain, identity: identity});

        }

    }

    getProviderNode(domain, cb) {

        let that = this;
        log.debug("GETTING PROVIDER NODE FOR : " + domain);

        if (!that.providers[domain]) {
            return cb(false);
        }

        let balanceAlgorithm = that.providers[domain].balance

        io
            . in(domain + '_provider')
            .clients((err, clients) => {
                log.debug("PROVIDER NODES FOR " + domain + " : ", clients);
                if (clients.length == 0) {
                    cb(false);
                    return;
                }
                let id = clients[Math.floor(Math.random() * clients.length)];
                cb(id);

            });

    }

    getClientId(uuid, domain, cb) {

        uuid = uuid.toLowerCase();

        dbi
            .clientConnectionStates
            .findOne({
                uuid: uuid,
                domain: domain
            }, {id: 1})
            .then(client => {

                log.debug("GOT CLIENT FOR " + domain + " : ", client);
                cb(client.id);

            })
            .catch(error => {

                log.warn("COULD NOT FIND CLIENT FOR " + uuid + "@" + domain);
                cb(false);

            })

    }

    getProviderStatus(domain, cb) {

        log.debug("GETTING PROVIDER STATUS FOR : " + domain);

        io
            . in(domain + '_provider')
            .clients((err, clients) => {
                cb(clients.length);
            });

    }

    deny(socket) {

        log.warn("CONNECTION DENIED");

    }

}

module.exports = Firewall;
