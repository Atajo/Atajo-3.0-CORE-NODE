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

        var _ = this;
        _.schemas = {};

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
                            _.schemas[rNam] = require(path.join(_.schemaDir, rNam));
                        } catch (e) {
                            log.error("COULD NOT REQUIRE SCHEMA " + rNam + " : " + e);
                        }
                    }

                }

                if (_.schemas.length == 0) {
                    reject("NO SCHEMAS DEFINED. NOT CONNECTING DB");
                    return;
                }

                //INIT THE SCHEMAS
                for (var schema in _.schemas) {

                    var schemaName = schema;
                    var schemaData = _.schemas[schema];

                    var schemaRefName = schemaName.replace('Schema', '') + 's';
                    log.debug("LOADING SCHEMA " + schemaName + " (" + schemaRefName + ")");

                    if (this.config.discriminate) {
                        _.schemas[schemaRefName] = (typeof _.schemas[schemaRefName] == 'undefined')
                            ? this
                                .Base
                                .discriminator(schemaName, new mongoose.Schema(schemaData, {timestamps: true}))
                            : _.schemas[schemaRefName];
                    } else {
                        _.schemas[schemaRefName] = (typeof _.schemas[schemaRefName] == 'undefined')
                            ? mongoose.model(schemaName, new mongoose.Schema(schemaData, {
                                timestamps: true,
                                usePushEach: true
                            }))
                            : _.schemas[schemaRefName];
                    }

                }

                resolve(_);

            });

        })

    }

    connect() {

        var _ = this;

        return new Promise((resolve, reject) => {

            let options = {
                native_parser: true,
                useMongoClient: true

            };

            log.info("MONGO:CONNECTING TO " + this.config.host);

            //CONNECT TO DB
            mongoose
                .connection
                .on('error', reject);
            mongoose
                .connection
                .once('open', function callback() {
                    resolve(_.schemas);
                });

            mongoose.connect(this.config.host, options);

        });

    }

}

module.exports = DBI