/**
 * Created by ngtmuzi on 2018/2/24.
 */
'use strict';

const redis  = require('services/redisClient');
const crypto = require('crypto');

class Locker {
  /**
   * 创建一个redis锁的管理对象
   * @param redis   ioredis实例
   */
  constructor(redis) {
    this.redis   = redis;
    this.lockMap = new Map();

    //定义lua脚本让它原子化执行
    this.redis.defineCommand('lua_unlock', {
      numberOfKeys: 1,
      lua         : `
        local remote_value = redis.call("get",KEYS[1])
        
        if (not remote_value) then
          return 0
        elseif (remote_value == ARGV[1]) then
          return redis.call("del",KEYS[1])
        else
          return -1
        end`
    });
  }

  /**
   * 锁定key，如已被锁定会抛错
   * @param key
   * @param expire    过期时间(毫秒)
   * @return {Promise<void>}
   */
  async lock(key, expire = 10000) {
    const value = crypto.randomBytes(16).toString('hex');

    let result = await this.redis.set(key, value, 'NX', 'PX', expire);
    if (result === null) throw new Error('lock error: key already exists');

    this.lockMap.set(key, {value, expire, time: Date.now()});
    return 'OK';
  }

  /**
   * 解锁key，无论key是否存在，解锁是否成功，都不会抛错（除网络原因外），具体返回值:
   * null: key在本地不存在    0:key在redis上不存在    1:解锁成功      -1:value不对应，不能解锁
   * @param key
   * @return {Promise<*>}
   */
  async unLock(key) {
    if (!this.lockMap.has(key)) return null;
    let {value, expire, time} = this.lockMap.get(key);
    this.lockMap.delete(key);

    return await this.redis.lua_unlock(key, value);
  }

  /**
   * 每隔interval时间就尝试一次锁定，当用时超过waitTime就返回失败
   * @param key
   * @param expire
   * @param interval
   * @param waitTime
   * @return {Promise<void>}
   */
  async waitLock(key, expire, interval = 500, waitTime = 5000) {
    let start_time = Date.now();
    let result;
    while ((Date.now() - start_time) < waitTime) {
      result = await this.lock(key, expire).catch(() => {});
      if (result === 'OK') return 'OK';
      else await delay(interval);
    }
    throw new Error('waitLock timeout');
  }
}

/**
 * 等待一段时间（毫秒）
 * @param ms
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports              = new Locker(redis);
module.exports.createLocker = Locker;