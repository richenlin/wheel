/**
 * Created by ngtmuzi on 2016/6/4.
 */
'use strict';
const config = global.config;

const UUID   = require('uuid');
const lodash = require('lodash');
const log4js = require('log4js');

const mkdir   = require('tools/mkdir');
const before  = require('tools/before');
const explain = require('tools/explain');

mkdir(config.logDir);
log4js.configure(config.logger.log4js);

let logger = log4js.getLogger(config.logger.logName);

logger.setLevel(config.logger.logLevel);

//在http请求返回时打印完整的调用日志
let cLogger = log4js.connectLogger(logger, {
  format: ':method\t:url\t:status\t:response-time ms\t:remote-addr\t:req[__uuid]\nrequest:\t:req[__requestdata]\nresponse:\t:req[__responsedata]',
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
  Object.defineProperty(req.headers, '__requestdata', {value: explain(Object.assign({}, req.query, req.body))});
  Object.defineProperty(req.headers, '__uuid', {value: UUID.v4().replace(/\W/g, '')});

  //打印请求日志
  logger.debug(`${req.method}\t${req.url}\t${req.headers.__requestdata}\t${req.headers.__uuid}`);

  //直接截获参数
  let saveData  = function (data) {
    Object.defineProperty(req.headers, '__responsedata', {value: req.headers.__responsedata || data && explain(data)});
  };
  //截获pipe中来源的数据
  let saveChunk = function (chunk) {
    Object.defineProperty(req.headers, '__responsechunk', {
      value: Buffer.concat([req.headers.__responsechunk || new Buffer(0), chunk])
    });
    Object.defineProperty(req.headers, '__responsedata', {
      value: explain(req.headers.__responsechunk.toString())
    });
  };

  res.on('pipe', req=>req.on('data', saveChunk));

  res.json = before(saveData, res.json.bind(res));
  res.send = before(saveData, res.send.bind(res));
  res.end  = before(saveData, res.end.bind(res));

  next();
}

logger.connectLogger = [loggerProxy, cLogger];

lodash.bindAll(logger, ['log', 'trace', 'debug', 'info', 'warn', 'error', 'fatal']);

module.exports = logger;