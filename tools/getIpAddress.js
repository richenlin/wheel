/**
 * Created by ngtmuzi on 2016/10/14.
 */
'use strict';
const lodash = require('lodash');
const os     = require('os');
/**
 * 获取本机的ipv4地址
 * @returns {*|string}
 */
function getIpAddress() {
  return lodash.chain(os.networkInterfaces())
    .values().flattenDeep()
    .filter(alias => alias.family === 'IPv4' && !alias.address.startsWith('127') && !alias.internal)
    .head()
    .get('address')
    .value();
}

module.exports = getIpAddress;