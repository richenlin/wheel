/**
 * Created by ngtmuzi on 2016/5/12.
 */
'use strict';
const fs       = require('fs');
const path     = require('path');
const chokidar = require('chokidar');

const lodash = require('lodash');

/**
 * watch and reload file, override it to target
 * @param filePath      {String}    full file path
 * @param target        {Object}    target object
 * @param defaultValue  {Object}    default value
 * @param onChange      {Function}  on file change callback
 */
function watchModule(filePath, target = {}, defaultValue, onChange) {
  if (typeof defaultValue === 'function') {
    onChange     = defaultValue;
    defaultValue = null;
  }
  //locate file path
  filePath = path.resolve(filePath);

  const update = function (firstRequire) {

    //make a backup
    const oldModule = lodash.cloneDeep(target);

    try {
      Object.keys(require.cache).forEach(function (cachePath) {
        if (cachePath.includes(filePath)) {

          //release the module.parent.children reference, code by fangshi
          let module = require.cache[cachePath];
          if (module.parent)
            module.parent.children.splice(module.parent.children.indexOf(module), 1);

          delete require.cache[cachePath];
        }
      });

      const newModule = Object.assign({}, defaultValue, require(filePath));
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
    if (onChange && firstRequire !== true) onChange(null, target, oldModule);

    return target;
  };

  //防抖动
  // fs.watch(filePath, {recursive: true}, lodash.debounce(update, 300));
  chokidar.watch(filePath).on('all', lodash.debounce(update, 300));

  return update(true);
}


/**
 * make target's property full like source
 * @param target {Object}
 * @param source {Object}
 * @return {*}
 */
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