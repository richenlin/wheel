/**
 * Created by ngtmuzi on 2016/7/20.
 */
'use strict';
const inspect  = require('util').inspect;
const truncate = require('lodash/truncate');
module.exports = (object, length = 1024) => truncate(inspect(object, {depth: null}).replace(/\n/g, ''), {length});