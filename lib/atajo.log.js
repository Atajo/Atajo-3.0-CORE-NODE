'use strict';

const bunyan = require('bunyan');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mkdirp = require('mkdirp');


class Log {


    constructor(release, logpath) {

        //CHECK IF LOG LOCATION EXISTS
        try {
            var stats = fs.statSync(logpath);
        } catch (e) {
            console.log("CREATING LOG PATH :  " + logpath);
            mkdirp(logpath);
        }

        const LogLevel = {
            DEBUG: 'debug',
            INFO: 'info',
            WARN: 'warning',
            ERROR: 'error'
        };

        let streams = [{
            stream: process.stdout,
            level: LogLevel.DEBUG
        }];

        if (release == 'prd') {
            const logFile = path.join(logpath, 'prd.log');
            fs.stat(logFile, function(err, stats) {
                if (err) {
                    fs.writeFileSync(logFile, '');
                }
                streams = [{
                    path: logFile,
                    level: LogLevel.WARN
                }];
            });

        } else if (release == 'qas') {
            const logFile = path.join(logpath, 'qas.log');
            fs.stat(logFile, function(err, stats) {
                if (err) {
                    fs.writeFileSync(logFile, '');
                }
                streams = [{
                    path: logFile,
                    level: LogLevel.INFO
                }];
            });
        } else {
            const logFile = path.join(logpath, 'dev.log');
            fs.stat(logFile, function(err, stats) {
                if (err) {
                    fs.writeFileSync(logFile, '');
                }
                streams = [{
                    path: logFile,
                    level: LogLevel.DEBUG
                }];
            });
        }

        const log = bunyan.createLogger({
            streams,
            name: release + '@' + os.hostname(),
            serializers: {
                req: bunyan.stdSerializers.req,
                res: bunyan.stdSerializers.res,
                error: bunyan.stdSerializers.err
            }
        });


        return log;

    }




}


module.exports = Log;