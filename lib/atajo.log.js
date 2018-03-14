'use strict';

const bunyan = require('bunyan');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mkdirp = require('mkdirp');
const PrettyStream = require('bunyan-prettystream'); 


class Log {


    constructor(release, logpath) {

        const prettyStdOut = new PrettyStream();
        prettyStdOut.pipe(process.stdout);

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
           // path: logFile,
            level: LogLevel.DEBUG,
            type: 'raw',
            stream: prettyStdOut
        }];

        if (release == 'prd') {
            const logFile = path.join(logpath, 'prd.log');
            fs.stat(logFile, function(err, stats) {
                if (err) {
                    fs.writeFileSync(logFile, '');
                }
                let streams = [{
                 //   path: logFile,
                    level: LogLevel.WARN,
                    type: 'raw',
                    stream: prettyStdOut
                }];
            });

        } else if (release == 'qas') {
            const logFile = path.join(logpath, 'qas.log');
            fs.stat(logFile, function(err, stats) {
                if (err) {
                    fs.writeFileSync(logFile, '');
                }
                let streams = [{
                  //  path: logFile,
                    level: LogLevel.INFO,
                    type: 'raw',
                    stream: prettyStdOut
                }];
            });
        } else {
            const logFile = path.join(logpath, 'dev.log');
            fs.stat(logFile, function(err, stats) {
                if (err) {
                    fs.writeFileSync(logFile, '');
                }
                let streams = [{
                  //  path: logFile,
                    level: LogLevel.DEBUG,
                    type: 'raw',
                    stream: prettyStdOut
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