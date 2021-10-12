const Rx = require('rxjs/Rx');
const config = require('../config');
let consul = null;

class Consul {

    constructor(opts) {

        this.consul = require('consul')(config.get('CONSUL').api);
        this.fetch = [];

        let fetchList = config
            .get('CONSUL')
            .fetch;
        for (var i in fetchList) {
            this.add(i, fetchList[i]);
        }

        return this;
    }

    add(key, token) {
        this
            .fetch
            .push({key: key, token: token});
    }

    start(interval = config.get('CONSUL').checkInterval) {

        let that = this;
        log.debug("Starting Consul Client [ Refresh every " + interval + "ms ]");

        return new Rx.Observable(observer => {

            that.observer = observer;
            that.interval = setInterval((() => that.process()), interval);
            that.process();

        });

    }

    stop() {
        log.debug("Stopping Consul Client");
        clearInterval(this.interval);
    }

    process() {

        var that = this;

        // for (var i in this.fetch) {

        //     let parameters = this.fetch[i];

        //     if (parameters.key.substr(parameters.key.length - 1) == '/') {
        //         parameters.recurse = true;
        //     }

            // that
            //     .consul
            //     .kv
            //     .get(parameters)
            //     .then(response => {
                    // if (response) {
                        //  console.log(response); log.debug("VALID CONSUL RESPONSE FOR", parameters);

                        // if (Array.isArray(response)) {
                            let recursiveResponse = {
                                'netcare-app': {
                                    "domain": "netcare-app",
                                    "key": "1eaefd0a6412789b8d1a96abee4188a18ffc9bc2",
                                    "url": "netcare-app.atajo.co.za",
                                    "owner": "werner.venter@britehouse.co.za",
                                    "support": "support@atajo.co.za",
                                    "logo": "",
                                    "icon": "",
                                    "core": {
                                      "dev": {
                                        "host": "atajo-3-core-prd-1-lb.atajo.io",
                                        "protocol": "https",
                                        "port": "443",
                                        "version": "1.0"
                                      },
                                      "qas": {
                                        "host": "atajo-3-core-prd-1-lb.atajo.io",
                                        "protocol": "https",
                                        "port": "443",
                                        "version": "1.0"
                                      },
                                      "prd": {
                                        "host": "atajo-3-core-prd-1-lb.atajo.io",
                                        "protocol": "https",
                                        "port": "443",
                                        "version": "1.0"
                                      }
                                    }
                                  }
                            };
                            // for (var i in response) {
                            //     const key = response[i]
                            //         .Key
                            //         .replace(parameters.key, '');

                            //     if(key == 'netcare-app') {
                            //         recursiveResponse[key] = JSON.parse(response[i].Value);
                            //     }
                            // }
                            // console.log('==========================');
                            // console.log({key: parameters.key, value: recursiveResponse});
                            that
                                .observer
                                .next({key: "mobility/domains/", value: recursiveResponse});
                        // } else {

                            that
                                .observer
                                .next({
                                    key: "mobility/core/providers",
                                    value: {
                                        "netcare-app": {
                                            "secret": "fb20b215bdd7d295a67f65bf76afc0c0b6a26d90",
                                            "key": "1eaefd0a6412789b8d1a96abee4188a18ffc9bc2",
                                            "allow": "*",
                                            "balance": "robin"
                                        },
                                        "netcare-assist": {
                                            "secret": "1e70007555123228332fc8b9507d48a896129cb2",
                                            "key": "446de4183e91203ed8019fdf51d826e4d1a27e4d",
                                            "allow": "*",
                                            "balance": "robin"
                                        }
                                    }
                                });
                        // }
                    // } else {
                    //     log.warn("INVALID CONSUL RESPONSE FOR", parameters)
                    // }
                // })
                // .catch(err => {
                //     log.error(err);
                //     that
                //         .observer
                //         .error(err);

                // });

        // }

    }

}

module.exports = Consul;