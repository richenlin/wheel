/**
 * Created by ngtmuzi on 2016/8/9.
 */
'use strict';
/** @global */
global.Promise = require('bluebird');
const config = global.config;
const logger = global.logger;

const http = require('http');
const path = require('path');

const express      = require('express');
const cookieParser = require('cookie-parser');
const bodyParser   = require('body-parser');
const curry        = require('lodash/curry');

const before = require('tools/before');

const routes = express.Router();

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

if (config.logger.connectLogger)app.use(logger.connectLogger);

app.use((req, res, next)=> {
  res.ok  = msg => res.json({code: 200, succeed: true, msg});
  res.err = curry((code, msg, ext) => res.json({code, succeed: false, msg, ext}));
  next();
});

app.use('/', routes);
app.routes = routes;

//404处理
app.use(function (req, res) {
  res.sendStatus(404);
});

//未捕获错误处理
app.use(function (err, req, res) {
  logger.error(`http app got unhandled error`, err);
  if (res.writable) res.status(500).err(500, err.message, err);
});

const httpServer = http
  .createServer(app)
  .on('error', err=> {
    logger.fatal(`create http server error : ${err.message}`);
    Promise.delay(1000, 1)   //给1秒钟时间报警
      .then(process.exit);
  })
  .on('listening', ()=> {
    logger.info(`http services running in http://localhost:${config.httpPort}`);
  })
  .listen(config.httpPort);


module.exports = app;
