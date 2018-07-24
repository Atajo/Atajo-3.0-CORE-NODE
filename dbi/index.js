var mongoose = require('mongoose');
var os = require('os');
var fs = require('fs');
var path = require('path');

class DBI {

    constructor(config) {

        this.config = config;

        if (!this.config.host) {
            log.error("COULD NOT INIT DB. HOST NOT SPECIFIED IN CONFIG");
            return;
        }

        mongoose.Promise = global.Promise;

        this.schemaDir = path.join(__dirname, 'schemas');

        if (this.config.discriminate) {

            this.baseOptions = {
                discriminatorKey: '__type',
                collection: 'data',
                timestamps: true
            }
            this.Base = mongoose.model('Base', new mongoose.Schema({}, this.baseOptions));
        }

        return this;

    }

    init() {

        this.schemas = {};

        return new Promise((resolve, reject) => {

            //LOAD THE SCHEMAS
            fs.readdir(this.schemaDir, (err, files) => {

                if (err) {
                    reject("COULD NOT READ SCHEMAS. MONGODB INIT FAILED : " + err);
                }

                for (var f in files) {

                    var file = files[f];
                    if (file.indexOf('.js') > -1) {
                        var rNam = file.replace('.js', '');
                        try {
                            this.schemas[rNam] = require(path.join(this.schemaDir, rNam));
                        } catch (e) {
                            log.error("COULD NOT REQUIRE SCHEMA " + rNam + " : " + e);
                        }
                    }

                }

                if (this.schemas.length == 0) {
                    reject("NO SCHEMAS DEFINED. NOT CONNECTING DB");
                    return;
                }

                //INIT THE SCHEMAS
                for (var schema in this.schemas) {

                    var schemaName = schema;
                    var schemaData = this.schemas[schema];

                    var schemaRefName = schemaName.replace('Schema', '') + 's';
                    log.debug("LOADING SCHEMA " + schemaName + " (" + schemaRefName + ")");

                    if (this.config.discriminate) {
                        this.schemas[schemaRefName] = (typeof this.schemas[schemaRefName] == 'undefined')
                            ? this
                                .Base
                                .discriminator(schemaName, new mongoose.Schema(schemaData, {timestamps: true}))
                            : this.schemas[schemaRefName];
                    } else {
                        this.schemas[schemaRefName] = (typeof this.schemas[schemaRefName] == 'undefined')
                            ? mongoose.model(schemaName, new mongoose.Schema(schemaData, {
                                timestamps: true,
                                usePushEach: true
                            }))
                            : this.schemas[schemaRefName];
                    }

                }

                resolve(this);

            });

        })

    }

    connect() {

        return new Promise((resolve, reject) => {

            let options = {
                native_parser: true
            };

            log.info("MONGO:CONNECTING TO " + this.config.host);

            //CONNECT TO DB
            mongoose
                .connection
                .on('error', reject);
            mongoose
                .connection
                .once('open', () => {
                    resolve(this.schemas);
                });

            mongoose.connect(this.config.host, options);

        });

    }

}

module.exports = DBI