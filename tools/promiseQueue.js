/**
 * @link https://ngtmuzi.github.io/实现一个简单的promise队列
 */
"use strict";

class Queue {
  constructor({promiseLibrary, concurrency} = {}) {
    this.concurrency = isNaN(+concurrency) ? 1 : +concurrency;
    this.queue       = [];
    this.runCount    = 0;
    this.Promise     = promiseLibrary || Promise;
    this._wait       = this.Promise.resolve();
  }

  add(fn) {
    return new this.Promise((resolve, reject) => {
      this.queue.push(() =>
        this._wait
          .then(fn)
          .then(value => this._wait.then(() => value))
          .then(resolve, reject)
      );
      this.consume();
    });
  }

  consume() {
    while (this.runCount < this.concurrency && this.queue.length) {
      this.runCount++;

      this.queue.shift()()
        .then(() => {
          this.runCount--;
          this.consume();
        });
    }
  }

  pause() {
    this._wait = new this.Promise((resolve) => {
      this._waitForResume = resolve;
    });
  }

  resume() {
    this._waitForResume && this._waitForResume();
    this.consume();
  }

  warp(fn, thisArg) {
    const self   = this;
    const warpFn = function () {
      return self.add(fn.bind(thisArg, ...arguments));
    };
    warpFn.queue = this;

    return warpFn;
  }
}

module.exports = Queue;