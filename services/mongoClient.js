/**
 * Created by ngtmuzi on 2016/8/5.
 */
'use strict';
global.Promise    = require('bluebird');
const MongoClient = require('mongodb').MongoClient;

const before  = require('tools/before');
const promixy = require('promixy').setDefault({methods: ['tap', 'map', 'return', 'timeout', 'each']});

const logger = global.logger;
const config = global.config;

function createClient(mongoUrl) {
  const db = promixy(MongoClient.connect(mongoUrl, {promiseLibrary: Promise}));

  db
    .then(function (db) {
      process.exit = before(()=>db.close(), process.exit);
      logger.info('mongodb connect success');
    })
    .catch(function (err) {
      logger.fatal('mongodb connect error', err.message);
      Promise.delay(1000, 1)   //给1秒钟时间报警
        .then(process.exit);
    });

  return db;
}

/**
 * @type {(Promise|Db)}
 */
module.exports = createClient(config.mongoUrl);

module.exports.createClient = createClient;