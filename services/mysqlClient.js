/**
 * Created by ngtmuzi on 2016/10/10.
 */
'use strict';
const config    = global.config;
const logger    = global.logger;
const Sequelize = require('sequelize');

function createClient(url, models = []) {
  const client = new Sequelize(url, {logging: logger.trace, benchmark: true});
  models.forEach(model => client.import(model));

  client.models.client  = client;
  client.models.connectSucceed = client.sync()
    .then(function () {
      logger.info('mysql connect success');
    })
    .catch(function (err) {
      logger.fatal('mysql connect error', err.message);
      return Promise.reject(err);
    });

  return client.models;
}

module.exports              = createClient(config.mysqlUrl, config.models);
module.exports.createClient = createClient;
