/**
 * Created by ngtmuzi on 2017/1/5.
 */
'use strict';
const config = global.config;
const logger = global.logger;

const lodash        = require('lodash');
const before        = require('tools/before');
const explain       = require('tools/explain');
const elasticsearch = require('elasticsearch');


/**
 * 创建一个elasticSearch的连接实例
 * @param url
 * @returns {*}
 */
function createClient(url) {
  const client = new elasticsearch.Client({host: url});

  const esBuff = [];

  /**
   * 插入单条文档到缓冲区
   * @param _index
   * @param _type
   * @param _id
   * @param doc
   */
  client.upsertDoc = function (_index, _type, _id, doc) {
    esBuff.push({update: {_index, _type, _id}});
    esBuff.push({doc, doc_as_upsert: true});
    if (esBuff.length >= 100) bulkDocs();
  };

  /**
   * 批量插入文档，立即写入并返回promise
   * @param docs  [{index,type,id}]
   */
  client.upsertDocs = function (docs) {
    if (!Array.isArray(docs) || !docs.length) return;

    docs.forEach(function ({_index, _type, _id, doc}) {
      esBuff.push({update: {_index, _type, _id}});
      esBuff.push({doc, doc_as_upsert: true});
    });

    return bulkDocs();
  };

  /**
   * 实际写入elasticsearch
   * @return {Promise}
   */
  function bulkDocs() {
    if (!esBuff.length) return Promise.resolve();

    return client.bulk({body: esBuff.splice(0, esBuff.length)})
      .then(function (result) {
        if (result.errors) {
          const err = lodash.chain(result.items).map(item => lodash.values(item)[0]).filter('error')
            .map(item => `${item._index}/${item._type}/${item._id} has error: [${item.error.type}](${item.status}):${item.error.reason}`)
            .join('\n').value();
          throw new Error(err);
        }
      });
  }

  client.connectSucceed = client.ping()
    .then(() => logger.info('elasticsearch connect success'))
    .catch(err => {
      logger.fatal('elasticsearch connect error', err.message);
      return Promise.reject(err);
    });

  //定时将缓冲区的文档写入elasticsearch
  setInterval(
    () => bulkDocs().catch(err => logger.error(`elasticsearch bulk error: ${err.message || err}`)),
    10 * 1000);
  process.exit = before(bulkDocs, process.exit);

  return client;
}

module.exports              = createClient(config.elasticUrl);
module.exports.createClient = createClient;