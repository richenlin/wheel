/**
 * Created by ngtmuzi on 2016/5/27.
 */
'use strict';
global.Promise = require('bluebird');

/**
 * 通用的Promise重试函数
 * @param fn      代码，返回promise或抛出错误
 * @param times   重试次数
 * @param delay   每次重试的延迟
 * @returns {Promise}
 */
function promiseRetry(fn, times, delay) {
  return Promise.try(fn)
    .catch(function (err) {
      if (times <= 1) return Promise.reject(err);

      return Promise.delay(+delay || 0)
        .then(function () {
          return promiseRetry(fn, times - 1, delay);
        });
    });
}

module.exports = promiseRetry;