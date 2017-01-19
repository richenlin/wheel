/**
 * WebService客户端模块
 * Created by ngtmuzi on 2016/11/8.
 */
'use strict';
const config = global.config;
const logger = global.logger;

global.Promise = require('bluebird');
const soap     = require('soap');

const promiseRetry = require('tools/promiseRetry');


function WebService(url) {
  const self          = this;
  self.connectSucceed = new Promise(function (resolve, reject) {
    soap.createClient(url, function (err, client) {
      if (err) {
        logger.fatal(`WebService connect error: ${err.message}: ${url}`);
        return reject(err);
      }
      logger.info(`WebService connect ${url} success`);
      resolve(client);

      self._client = Promise.promisifyAll(client);
    });
  });
}

WebService.prototype.invoke = function (funcName, args) {
  const that = this;
  return promiseRetry(function () {
    return that._client[funcName + 'Async'](args).get('0');
  }, 2, 3000);
};


module.exports = WebService;