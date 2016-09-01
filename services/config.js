/**
 * Created by ngtmuzi on 2016/6/3.
 */
'use strict';

const lodash      = require('lodash');
const evaluate    = require('tools/evaluate');
const watchModule = require('tools/watchModule');

/**
 * 根据默认目录读取配置文件,默认配置文件为当前运行目录下的package.json和config目录
 * 从package.json中获取项目名，并以此监视以下可能的配置目录：
 * C:/config/${project.name}、/etc/config/${project.name}
 * 当命令行有--configFile值时，监视该路径
 * 覆盖顺序为右边覆盖左边
 * @param packagePath   {String}      指定package.json
 * @param extendDefault [{Object}]    附加的默认文件路径
 * @param extendWatch   [{String}]    附加的监视路径
 * @return {Object}
 */
function loadConfig(packagePath, extendDefault = [], extendWatch = []) {
  if (!packagePath)packagePath = process.cwd() + '/package.json';
  if (!resolveFile(packagePath)) {
    console.error(`can't find package.json on : ${packagePath}`);
    process.exit(1);
  }
  const project = process.project = require(packagePath);
  process.ip = getIpAddress();

  let argvConfig          = {}, argvConfigFile = '';
  const argvConfigExp     = /^\-\-config\=(.*)/i;
  const argvConfigFileExp = /^\-\-configFile\=(.*)/i;

  process.argv.slice(2).forEach(function (str) {
    if (argvConfigExp.test(str)) argvConfig = evaluate(argvConfigExp.exec(str)[1]);
    if (argvConfigFileExp.test(str)) argvConfigFile = argvConfigFileExp.exec(str)[1];
  });

  return watchConfig([
    {config: `C:/config`, watch: false},
    {config: `/etc/config`, watch: false},
    {config: `${process.cwd()}/config`, watch: false},
    ...extendDefault.map(file=>({config: file, watch: false})),

    {config: `C:/config/${project.name}`, watch: true},
    {config: `/etc/config/${project.name}`, watch: true},
    ...extendWatch.map(file=>({config: file, watch: true})),

    {config: argvConfig, watch: false},
    {config: argvConfigFile, watch: true}
  ]);

}

/**
 * @param configs    [{Object}]      按数组顺序覆盖前面的配置
 */
function watchConfig(configs) {
  const finalConfig   = {};
  const eventHandlers = [];

  Object.defineProperty(finalConfig, 'onChange', {
    value(fn){
      if (typeof fn === 'function') eventHandlers.push(fn);
    }
  });


  const watchConfigs = configs
    .map(function ({config, watch}) {
      //如果是对象或其他东西就直接返回本身
      if (typeof config !== 'string') return config;
      //无法定位到的文件
      if (!resolveFile(config))return null;

      if (watch) {
        console.log(`start watching file : ${config}`);
        return watchModule(config, {}, ()=> {
          console.log(`${config} has change, reload.`);
          rebuildConfig();

          //调用订阅的回调
          eventHandlers.forEach(function (fn) {
            try {
              fn(finalConfig);
            } catch (err) { }
          });
        });
      } else {
        console.log(`loading config file : ${config}`);
        return require(config);
      }
    });

  function rebuildConfig() {
    return override(finalConfig, lodash.merge({}, ...watchConfigs));
  }

//first run
  return rebuildConfig();

}

function override(target, source) {
  Object.keys(target).forEach(function (key) {
    if (!source.hasOwnProperty(key)) delete target[key];
  });
  Object.keys(source).forEach(function (key) {
    target[key] = source[key];
  });
  return target;
}


/**
 * 使用require来定位文件
 * @param path
 */
function resolveFile(path) {
  try {
    return require.resolve(path);
  } catch (err) {
    return undefined;
  }
}


/**
 * 获取本机的ipv4地址
 * @returns {*|string}
 */
function getIpAddress() {
  let interfaces = require('os').networkInterfaces();
  for (let devName in interfaces) {
    let iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      let alias = iface[i];
      if (alias.family === 'IPv4' && alias.address.indexOf('127') !== 0 && !alias.internal) {
        return alias.address;
      }
    }
  }
}

module.exports = loadConfig;