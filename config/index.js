'use strict';

const path = require('path');
const nconf = require('nconf');
const release = process.argv[2] || process.env.CORE_ENV || 'dev';
const host = require('os').hostname();

nconf
    .argv()
    .env()
    .file('package', 'package.json')
    .file({
        file: path.join(__dirname, 'conf', `${release}.json`)
    })

nconf.defaults({ release: release, host: host });

module.exports = nconf;
