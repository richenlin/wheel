'use strict';
const crypto = require('crypto');

function md5(data) {
  const hash = crypto.createHash('md5');
  hash.update(data);
  return hash.digest('hex');
}

module.exports = md5;