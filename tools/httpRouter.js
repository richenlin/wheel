/**
 * Created by ngtmuzi on 2016/9/5.
 */
'use strict';
global.Promise   = require('bluebird');
const URL        = require('url');
const lodash     = require('lodash');
const pathRegexp = require('path-to-regexp');

/**
 * 解析路由对象并将方法挂载在对应路径上，并将req中的数据提取出来
 * @param router
 * @returns {Function}
 */
module.exports = function (router) {
  const keyMaps = lodash.map(pave(router), (fn, exp) => {
    let keys = [];
    return {regExp: pathRegexp(exp, keys), fn, keys};
  });

  return function (req, res, next) {
    const msg     = Object.assign({}, req.query, req.body);
    const headers = lodash.mapKeys(req.headers, lodash.camelCase);
    const path    = URL.parse(req.url).pathname;

    headers.method = req.method.toLowerCase();

    let match = keyMaps.some(({regExp, fn, keys}) => {
      if (!regExp.test(path)) return false;
      let m = regExp.exec(path);
      keys.forEach((key, i) => msg[key.name] = m[i + 1]);

      return Promise.try(() => fn(msg, headers, req, res, next))
        .then(msg => {
          if (res.finished || lodash.isNil(msg)) return;
          res.json({code: 0, succeed: true, msg});
        })
        .catch(({code, message, msg, ext}) => {
          if (res.finished) return;
          res.json({code: code || 500, succeed: false, msg: msg || message || 'un handle error', ext});
        });
    });
    if (!match) next();
  };
};

/**
 * 展平路由
 * @param obj
 * @param pre
 * @returns {*}
 */
function pave(obj, pre = '') {
  return Object.assign({}, ...lodash.flatMap(obj, (value, key) => {
    if (lodash.isPlainObject(value)) return pave(value, `${pre}/${key}`);
    else return {[`${pre}/${key}`]: value};
  }));
}

/**
 * 方便生成reject的函数
 * @param code
 * @param message
 * @param ext
 * @returns {Promise.<*>}
 */
function reject(code, message, ext) {
  return Promise.reject({code, message, ext});
}

module.exports.reject = reject;