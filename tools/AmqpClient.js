'use strict';
global.Promise = require('bluebird');

const AMQPLib = require('amqplib');
const lodash  = require('lodash');

const _ = require('promixy').setDefault({methods: ['map', 'tap', 'return']});

/**
 * 返回一个amqp的channel实例
 * @param rmqUrl
 * @param maxMsg
 * @return {(Promise|Channel)}
 */
function createClient(rmqUrl, maxMsg = 1024) {

  const connection = _(AMQPLib.connect(rmqUrl, {allowHalfOpen: false}));

  const channel = connection.createChannel();

  channel.prefetch(maxMsg);
  

  /**
   * 声明一个队列
   * @param queue
   * @param opts
   * @returns {*}
   */
  channel._assertQueue = lodash.memoize(channel.assertQueue);

  /**
   * 发送消息到指定queue
   * @param queue
   * @param msg
   * @param opts
   * @returns {*}
   */
  channel._sendToQueue = function (queue, msg, opts) {
    if (typeof msg === 'object')msg = JSON.stringify(msg);
    if (!(msg instanceof Buffer))msg = new Buffer(msg);

    return channel
      ._assertQueue(queue)
      .return(channel)
      .sendToQueue(queue, msg, opts);
  };


  /**
   * 订阅一个队列的消息（包括历史消息）
   * @param queue  {String}   队列名
   * @param fn     {Function} 回调函数
   * @param opts   {Object}   参数
   */
  channel.subscribeQueue = function (queue, fn, opts) {
    return channel
      ._assertQueue(queue)
      .return(channel)
      .consume(queue, fn, opts);
  };

  /**
   * 取消订阅
   * @param consumerTag  {String}   客户端订阅时生成的consumerTag
   */
  channel.unSubscribeQueue = channel.cancel;


  /**
   * 创建一个独享队列，用于订阅exchange的路由消息（不会收到订阅前的消息）
   * @param exchange  exchange名
   * @param key       路由key
   * @param fn        回调函数
   */
  channel.subscribeRoute = function (exchange, key, fn) {
    return channel._assertQueue(`callback.${process.project.name}.${Date.now()}`, {exclusive: true}).queue
      .tap(queue => channel.bindQueue(queue, exchange, key))
      .tap(queue => channel.consume(queue, fn));
  };


  /**
   * 回拒所有消息，关闭连接
   */
  channel.close = ()=> channel.nackAll().then(connection.close);


  /**
   * 声明exchange
   */
  channel._assertExchange = lodash.memoize(channel.assertExchange);


  /**
   * 发送exchange消息
   * @param exchange
   * @param key       路由key
   * @param msg       消息内容
   * @param opts      额外参数
   * @returns {Promise}
   */
  channel._publish = function (exchange, key, msg, opts) {
    if (typeof msg === 'object')msg = JSON.stringify(msg);
    if (!(msg instanceof Buffer))msg = new Buffer(msg);
    return channel
      ._assertExchange(exchange, 'topic')
      .return(channel)
      .publish(exchange, key, msg, opts);
  };

  return channel;
}

/**
 * @property {Function} _publish
 * @property {Function} _assertQueue
 * @property {Function} _assertExchange
 * @property {Function} _sendToQueue
 * @property {Function} subscribeQueue
 * @property {Function} subscribeRoute
 */
module.exports = createClient;