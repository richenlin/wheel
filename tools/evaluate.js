/**
 * Created by ngtmuzi on 2016/7/21.
 */
"use strict";

/**
 * 尝试根据字面量字符串来构成一个对象
 * @note  注意：可以访问全局对象
 * @param str           字面量
 * @param defaultValue  默认值，若不指定则返回原字符串
 * @returns {*}
 */
function evaluate(str, defaultValue) {
  try {
    //普通返回
    return new Function(`return (${str});`)();
  } catch (err) {
    try {
      //尝试包裹对象
      return new Function(`return ({${str}});`)();
    } catch (err) {
      return arguments.length >= 2 ? defaultValue : str;
    }
  }
}

module.exports = evaluate;