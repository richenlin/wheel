/**
 * Created by ngtmuzi on 2016/5/31.
 */
'use strict';
global.Promise = require('bluebird');

/**
 * 先执行某个函数再执行某个函数（注意绑定上下文），用于在某个函数前面加上预处理函数
 * @param before        {Function}  先执行的
 * @param after         {Function}  后执行的
 * @param ignoreError   {Boolean}   是否忽略错误
 * @param timeout       {Boolean}   超时时间
 * @returns {Function}
 */
function before(before, after, ignoreError = true, timeout = 10 * 1000) {
  return function () {
    return Promise
      .resolve(arguments)
      .bind(this)
      .spread(before)
      .timeout(timeout)
      .catch(e=> ignoreError ? null : Promise.reject(e))
      .return(arguments)    //参数传给后执行的函数
      .spread(after)
      .catch(e=> ignoreError ? null : Promise.reject(e));
  };
}

module.exports = before;