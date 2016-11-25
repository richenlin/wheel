/**
 * Created by ngtmuzi on 2016/8/17.
 */
'use strict';
const later  = require('later');
const lodash = require('lodash');

later.date.localTime();

function CronTasks(fns, exps) {
  this.tasks = [];
  this.reload(fns, exps);
}

CronTasks.prototype.reload = function (fns = {}, exps = {}) {
  this.clear();
  if (Array.isArray(fns)) {
    //fns:[{task:fn1,cronExp:'0 1/5'},{task:fn2,cronExp:'0 1/15'}]
    this.tasks = fns.map(({task, cronExp}) => {
      return cronExp ?
        later.setInterval(task, later.parse.cron(cronExp, true)) :
        null;
    }).filter(Boolean);

  } else {
    //fns:{a:fn1,b:fn2}   exps:{a:'0 1/5',b:null}
    this.tasks = lodash.map(fns, (fn, taskName) => {
      return exps[taskName] ?
        later.setInterval(fn, later.parse.cron(exps[taskName], true)) :
        null;
    }).filter(Boolean);
  }
  console.log(`add ${this.tasks.length} cron tasks.`);
};

CronTasks.prototype.clear = function () {
  if (!this.tasks.length) return;
  console.log(`clear ${this.tasks.length} cron tasks.`);
  this.tasks.forEach(t => t.clear());
  this.tasks = [];
};

/**
 * @class
 * @type {CronTasks}
 */
module.exports = CronTasks;