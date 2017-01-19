/**
 * Created by ngtmuzi on 2016/6/4.
 */
'use strict';
const config = global.config;

const UUID   = require('uuid');
const lodash = require('lodash');
const log4js = require('log4js');
const mdiff  = require('mdiff').default;

const mkdir     = require('tools/mkdir');
const before    = require('tools/before');
const explain   = require('tools/explain');
const CronTasks = require('tools/CronTasks');

const imAlert = function () { };
let logger    = log4js.getLogger(config.logger.logName);
mkdir(config.logDir);

const alerts   = {warn: {logs: [], firstTime: null}, error: {logs: [], firstTime: null}};
const cronTask = new CronTasks();
function reloadConfig() {

  log4js.configure(lodash.cloneDeep(config.logger.log4js));

  //打开IM报警
  if (config.imAlert) log4js.addAppender(imAlertAppender);
  if (config.elasticUrl && config.logger.elasticLog) log4js.addAppender(elasticAppender());

  logger.setLevel(config.logger.logLevel);

  cronTask.reload([
    {task: cronWarn, cronExp: config.warnCronExp || '0 */5'},
    {task: cronError, cronExp: config.errorCronExp || '0 */1'}
  ]);
}
reloadConfig();
config.onChange(['imAlert', 'logger'], reloadConfig);

//在http请求返回时打印完整的调用日志
let cLogger = log4js.connectLogger(logger, {
  format: function (req, res, format) {
    return `${format(':remote-addr\t:method\t:url\t:status\t:response-time ms')}\t${req.__logInfo.uuid}
    request:\t${req.__logInfo.reqData}
    response:\t${req.__logInfo.resData}`;
  },
  level : 'debug'
});


/**
 * 整合req的请求数据
 * 代理res的send、json、end、pipe等返回函数以截获返回内容
 * 用Object.defineProperty挂载数据到req.headers字段，避免被打印出来
 * @param req
 * @param res
 * @param next
 */
function loggerProxy(req, res, next) {
  const logInfo = {};
  Object.defineProperty(req, '__logInfo', {value: logInfo});

  logInfo.reqData = explain(Object.assign({}, req.query, req.body));
//  req.on('data', function (chunk) {
//    logInfo.reqChunk = Buffer.concat([logInfo.reqChunk || new Buffer(0), chunk]);
//    logInfo.reqData  = logInfo.reqChunk.toString();
//  });
  logInfo.ip = req.headers['x-forwarded-for'] ||
    req.ip ||
    req._remoteAddress ||
    (req.socket &&
      (req.socket.remoteAddress ||
        (req.socket.socket && req.socket.socket.remoteAddress)
      )
    );

  logInfo.uuid = UUID.v4().replace(/\W/g, '');

  //打印请求日志
  logger.debug(`${logInfo.ip}\t${req.method}\t${req.url}\t${logInfo.reqData}\t${logInfo.uuid}`);

  //直接截获参数
  let saveData  = function (data) {
    logInfo.resData = logInfo.resData || data && explain(data);
  };
  //截获pipe中来源的数据
  let saveChunk = function (chunk) {
    logInfo.resChunk = Buffer.concat([logInfo.resChunk || new Buffer(0), chunk]);
    logInfo.resData  = logInfo.resChunk.toString();
  };

  res.on('pipe', req => req.on('data', saveChunk));

  res.json = before(saveData, res.json.bind(res));
  res.send = before(saveData, res.send.bind(res));
  res.end  = before(saveData, res.end.bind(res));

  next();
}

logger.connectLogger = [loggerProxy, cLogger];


/**
 * IM报警插件
 */
function imAlertAppender(logEvent) {
  const log = log4js.layouts.messagePassThroughLayout(logEvent);
  if (logEvent.level.isEqualTo('warn')) {
    let length = alerts.warn.logs.push(log);
    if (length === 1) alerts.warn.firstTime = new Date();
    if (length >= config.maxWarn) cronWarn(Math.floor((new Date() - alerts.warn.firstTime) / 100) / 10 + '秒');
  } else if (logEvent.level.isEqualTo('error')) {
    let length = alerts.error.logs.push(log);
    if (length === 1) alerts.error.firstTime = new Date();
    if (length >= config.maxError) cronError(Math.floor((new Date() - alerts.error.firstTime) / 100) / 10 + '秒');
  } else if (logEvent.level.isGreaterThanOrEqualTo('fatal')) {
    imAlert(log).catch(err => logger.warn(err.message));
  }
}

function elasticAppender() {
  log4js.loadAppender('log4js-elasticsearch');

  log4js.layouts.addLayout('runLog', function (config) {
    return function (logEvent) {
      return {
        level    : logEvent.level.levelStr,
        levelNum : logEvent.level.level,
        timestamp: logEvent.startTime,
        log      : log4js.layouts.messagePassThroughLayout(logEvent),
        ip       : process.ip,
        exts     : null
      };
    };
  });

  return log4js.appenderMakers['log4js-elasticsearch']({
    type     : "log4js-elasticsearch",
    url      : config.elasticUrl,
    typeName : config.logger.elasticLayout || 'runLog',
    indexName: config.esIdxName,
    timeout  : 3000,
    layout   : {
      type: config.logger.elasticLayout || 'runLog',
    }
  });

}

function cronWarn(interval) {
  if (alerts.warn.logs.length && (alerts.warn.logs.length >= config.minWarn)) {
    imAlert(`${interval || config.warnCronExp} 间隔内产生 ${alerts.warn.logs.length} 条警告日志:\n` + countLogs(alerts.warn.logs), 1024)
      .catch(err => logger.warn(err.message));
  }
  alerts.warn.logs = [];
}

function cronError(interval) {
  if (alerts.error.logs.length && (alerts.error.logs.length >= config.minError)) {
    imAlert(`${interval || config.errorCronExp} 间隔内产生 ${alerts.error.logs.length} 条错误日志:\n` + countLogs(alerts.error.logs), 1024)
      .catch(err => logger.warn(err.message));
  }
  alerts.error.logs = [];
}

/**
 * 按数量排序并返回字符串
 * @param logs
 */
function countLogs(logs) {
  return lodash
    .chain(groupLogs(logs))
    .toPairs()
    .sortBy(1)
    .reverse()
    .map(([item, count]) => `${item}\t${count}条`)
    .join('\n')
    .value();
}


/**
 * 如果两个字符串相似度达到80%，则将差异部分改成xxx并返回，如果不相似则返回undefined
 * @param a
 * @param b
 */
function sameStr(a, b) {
  const d   = mdiff(a, b);
  const str = (a.length >= b.length ? a : b).split('');
  if (d.getLcs() && (d.getLcs().length / str.length) > 0.8) {
    d.scanDiff(function (aS, aE, bS, bE) {
      const s = (a.length >= b.length ? aS : bS);
      const e = (a.length >= b.length ? aE : bE);
      for (let i = s; i < e; i++) {
        str[i] = 'x';
      }
    });
    return str.join('');
  }
}

/**
 * 返回按相似字符串做分组后的统计obj
 * @param logs
 */
function groupLogs(logs) {
  return logs.reduce((obj, log) => {
    let oldKey = Object.keys(obj).find(key => sameStr(key, log));

    if (oldKey) {
      let newKey  = sameStr(oldKey, log);
      obj[newKey] = obj[oldKey] + 1;
      if (oldKey !== newKey) delete obj[oldKey];
    } else {
      obj[log] = 1;
    }
    return obj;
  }, {});
}

lodash.bindAll(logger, ['log', 'trace', 'debug', 'info', 'warn', 'error', 'fatal']);

module.exports = logger;