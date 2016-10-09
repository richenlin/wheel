"use strict";
var Promise = require('bluebird');

/**
 * promise的执行队列
 * @param concurrency 并发数
 * @constructor
 */
function Queue(concurrency) {
  if (!(this instanceof Queue)) return new Queue(concurrency);

  this.consumer = this._consumer.bind(this);
  this.queue    = [];
  this.runCount = 0;
  this.config(concurrency);
  this.consumer   = this._consumer.bind(this);
  this.pauseState = false;
  this.wait       = Promise.resolve();
}

/**
 * 添加函数到队列
 * @param fn
 */
Queue.prototype.add = function (fn) {
  var queue = this.queue;
  setImmediate(this.consumer);

  return new Promise(function (resolve, reject) {
    queue.push(function () {
      return Promise.try(fn)
        .then(resolve, reject);
    });
  });
};

/**
 * 配置并发数
 * @param concurrency 并发数
 */
Queue.prototype.config = function (concurrency) {
  this.concurrency = +concurrency || 1;
  for (var i = 0; i < this.concurrency; i++) {
    setImmediate(this.consumer);
  }
};

/**
 * 暂停
 */
Queue.prototype.pause = function () {
  var self        = this;
  this.pauseState = true;
  this.wait       = new Promise(function (resolve) {
    self.waitForResume = resolve;
  });
};

/**
 * 恢复
 */
Queue.prototype.resume = function () {
  this.pauseState = false;
  this.waitForResume && this.waitForResume();
  for (var i = 0; i < this.concurrency; i++) {
    setImmediate(this.consumer);
  }
};

/**
 * 消费
 */
Queue.prototype._consumer = function () {
  var self = this;

  if (this.runCount >= this.concurrency ||
    this.queue.length === 0 ||
    this.pauseState
  ) return;

  this.runCount++;
  Promise.try(this.queue.shift())
    .tap(function () {
      return self.wait;
    })
    .finally(function () {
      self.runCount--;
      setImmediate(self.consumer);
    });
};

module.exports = Queue;