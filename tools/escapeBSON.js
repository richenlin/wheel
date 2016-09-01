/**
 * Created by ngtmuzi on 2016/8/11.
 */
'use strict';
const lodash = require('lodash');

module.exports = escapeBSON;

/**
 * mongo文档的键名不允许出现.与$，因此需将这些字符改为其他代替字符
 * @param object {Object}
 * @returns {Object}
 */
function escapeBSON (object) {
  if (!lodash.isPlainObject(object)) return object;
  return lodash.transform(object, function(result, value, key) {
    result[key.replace(/\./g, '．').replace(/\$/g,'＄')] = escapeBSON(value);
  });
}