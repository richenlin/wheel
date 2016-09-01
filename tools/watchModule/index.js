/**
 * Created by ngtmuzi on 2016/5/12.
 */
'use strict';
var fs   = require('fs');
var path = require('path');

var lodash = require('lodash');

function watchModule(filePath, target, defaultValue, onChange) {
  if (typeof defaultValue === 'function') {
    onChange     = defaultValue;
    defaultValue = null;
  }
  //locate file path
  filePath = path.resolve(filePath);

  var update = function (firstRequire) {

    //make a backup
    var oldModule = Object.assign({}, target);

    try {
      Object.keys(require.cache).forEach(function (cachePath) {
        if (cachePath.includes(filePath)) {
          delete require.cache[cachePath];
        }
      });

      var newModule = Object.assign({}, defaultValue, require(filePath));
      //overwrite target
      override(target, newModule);
    } catch (err) {
      //throw Error on first require
      if (firstRequire === true) throw err;
      //if has error,rollback to old Module
      override(target, oldModule);

      if (onChange)return onChange(err, target);
    }

    //callback
    if (onChange && firstRequire !== true)onChange(null, target);

    return target;
  };

  //防抖动
  fs.watch(filePath, {recursive: true}, lodash.debounce(update, 300));

  return update(true);
}


function override(target, source) {
  Object.keys(target).forEach(function (key) {
    if (!source.hasOwnProperty(key)) delete target[key];
  });
  Object.keys(source).forEach(function (key) {
    target[key] = source[key];
  });
  return target;
}

module.exports = watchModule;