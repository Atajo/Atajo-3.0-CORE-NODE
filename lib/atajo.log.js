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

        const LogLevel = {
            DEBUG: 'debug',
            INFO: 'info',
            WARN: 'warning',
            ERROR: 'error'
        };

        let streams = [
            {
                // path: logFile,
                level: LogLevel.DEBUG,
                type: 'raw',
                stream: prettyStdOut
            }
        ];

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