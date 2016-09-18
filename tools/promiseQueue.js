"use strict";
var Promise = require('bluebird');

/**
 * promise的执行队列
 * @param concurrency 并发数
 * @constructor
 */
function Queue(concurrency) {
  if (!(this instanceof Queue)) return new Queue(concurrency);

  this.queue    = [];
  this.runCount = 0;
  this.config(concurrency);
}

/**
 * 添加函数到队列
 * @param fn
 */
Queue.prototype.add = function (fn) {
  var queue = this.queue;
  setImmediate(this._consumer.bind(this));

  return new Promise(function (resolve, reject) {
    queue.push(function () {
      return Promise.try(fn).then(resolve, reject);
    });
  });
};

/**
 * 配置并发数
 * @param concurrency 并发数
 */
Queue.prototype.config = function (concurrency) {
  this.concurrency = +concurrency || 1;
  setImmediate(this._consumer.bind(this));
};


/**
 * 消费
 * @returns {*}
 */
Queue.prototype._consumer = function () {
  var self = this;

  if (this.runCount >= this.concurrency || this.queue.length === 0) return;

  this.runCount++;
  Promise.try(this.queue.shift())
    .then(function () {
      self.runCount--;
      setImmediate(self._consumer.bind(self));
    });
};

module.exports = Queue;