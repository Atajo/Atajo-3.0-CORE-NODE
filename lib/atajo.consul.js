const Rx = require('rxjs/Rx');
const config = require('../config');
let consul = null;



class Consul {

    constructor(opts) {

        this.consul = require('consul')(config.get('CONSUL').api);
        this.fetch = [];

        let fetchList = config.get('CONSUL').fetch;
        for (var i in fetchList) {
            this.add(i, fetchList[i]);
        }

        return this;
    }


    add(key, token) {
        this.fetch.push({ key: key, token: token });
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

        for (var i in this.fetch) {

            let parameters = this.fetch[i];

            if (parameters.key.substr(parameters.key.length - 1) == '/') {
                parameters.recurse = true;
            }

            that.consul.kv.get(parameters).then(response => {
                if (response) {
                    //  console.log(response);

                    log.debug("VALID CONSUL RESPONSE FOR", parameters);

                    if (Array.isArray(response)) {
                        let recursiveResponse = {};
                        for (var i in response) {
                            const key = response[i].Key.replace(parameters.key, '');
                            recursiveResponse[key] = JSON.parse(response[i].Value);
                        }
                        that.observer.next({ key: parameters.key, value: recursiveResponse });
                    } else {

                        that.observer.next({ key: response.Key, value: JSON.parse(response.Value) });
                    }
                } else {
                    log.warn("INVALID CONSUL RESPONSE FOR", parameters)
                }
            }).catch(err => {
                log.error(err);
                that.observer.error(err);

            });

        }

    }

}


module.exports = Consul;