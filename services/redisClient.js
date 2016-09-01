/**
 * Created by ngtmuzi on 2016/8/6.
 */
'use strict';
const config = global.config;

const Redis = require('ioredis');

function createClient() {
  return new Redis(config.redisUrl);
}

module.exports = createClient(config.redisUrl);

module.exports.createClient = createClient;