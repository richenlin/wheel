/**
 * Created by ngtmuzi on 2016/8/9.
 */
"use strict";
const fs   = require('fs');
const path = require('path');

function mkdir(dir) {
  if (fs.existsSync(dir)) return;

  mkdir(path.dirname(dir));
  fs.mkdirSync(dir);
}

module.exports = mkdir;