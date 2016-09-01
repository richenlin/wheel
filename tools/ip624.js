/**
 * Created by ngtmuzi on 2016/5/17.
 */
'use strict';
var ipaddr = require('ipaddr.js');
/**
 * 将IPv6 地址转换为 IPv4 地址
 * @param ip
 * @returns {*}
 */
module.exports = function (ip) {
  if (ipaddr.IPv6.isValid(ip)) {
    var addr = ipaddr.parse(ip);
    if (addr.isIPv4MappedAddress()) {
      return addr.toIPv4Address().octets.join('.');
    }
  }
  return ip;
};