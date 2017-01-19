/**
 * Created by ngtmuzi on 2016/6/3.
 */
'use strict';

const path = require('path');

const lodash  = require('lodash');
const rqSync  = require('syncrequest').sync;
const rqAsync = require('request-promise');

const pave         = require('tools/pave');
const evaluate     = require('tools/evaluate');
const watchModule  = require('tools/watchModule');
const getIpAddress = require('tools/getIpAddress');

const argvConfigRootDirExp = /^--configRootDir=(.*)/i;
const argvConfigExp        = /^--config=(.*)/i;
const argvConfigFileExp    = /^--configFile=(.*)/i;

const eventHandlers = [];
let allConfigs;
const webConfig     = {};
global.config       = {};


Object.defineProperty(global.config, 'onChange', {
  value(props, fn){
    if (typeof props === 'function' && !fn) {
      fn    = props;
      props = [];
    }
    if (!Array.isArray(props)) props = [props];
    if (typeof fn === 'function') eventHandlers.push([props, fn]);
  }
});

/**
 * 判断变化的属性键并触发订阅函数
 * @param conf
 * @param oldConf
 */
function configOnChange(conf, oldConf) {
  //调用订阅的回调
  const newData = lodash.toPairs(pave(conf));
  const oldData = lodash.toPairs(pave(oldConf));

  //计算出具体哪几项属性发生了改变
  const diffPaths = lodash.uniqBy(
    lodash.map(
      lodash.flatten([
        lodash.differenceWith(newData, oldData, lodash.isEqual),
        lodash.differenceWith(oldData, newData, lodash.isEqual)
      ]), 0));

  if (!diffPaths.length) return;

  console.log('global.config has change:', diffPaths.map(path => `${path} = ${lodash.get(global.config, path)}`).join(', '));

  eventHandlers.forEach(function ([props, fn]) {
    //若订阅属性数为0，则所有变动都会通知，或者订阅的属性有改变，则通知
    if (props.length === 0 || diffPaths.some(path => props.some(prop => path.includes(prop)))) {
      try { fn(); } catch (err) { }
    }
  });
}


/**
 * 根据默认目录读取配置文件,默认配置文件为当前运行目录下的package.json和config目录
 * 从package.json中获取项目名，并以此监视以下可能的配置目录：
 * C:/config/${project.name}、/etc/config/${project.name}
 * 当命令行有--configFile值时，监视该路径
 * 覆盖顺序为右边覆盖左边
 * @param packagePath   {String}      指定package.json
 * @param extendDefault [{Object}]    附加的默认文件路径
 * @param extendWatch   [{String}]    附加的监视路径
 * @param configRootDir {String}      配置文件根目录
 * @return {Object}
 */
function loadConfig(packagePath, {extendDefault = [], extendWatch = [], configRootDir = 'config'} = {}) {

  if (!packagePath) packagePath = process.cwd() + '/package.json';
  if (!resolveFile(packagePath)) {
    console.error(`can't find package.json on : ${packagePath}`);
    process.exit(1);
  }
  const project = process.project = require(packagePath);
  process.ip = getIpAddress();

  let argvConfig = {}, argvConfigFiles = [];
  let envConfig  = {}, envConfigFiles = [];

  process.argv.slice(2).forEach(function (argv) {
    if (argvConfigRootDirExp.test(argv)) {
      configRootDir = argvConfigRootDirExp.exec(argv)[1];
    }
    if (argvConfigExp.test(argv)) {
      console.log('use args : ' + argv);
      argvConfig = evaluate(argvConfigExp.exec(argv)[1]);
    }
    if (argvConfigFileExp.test(argv)) {
      console.log('use args : ' + argv);
      argvConfigFiles = argvConfigFileExp.exec(argv)[1].split(',');
    }
  });

  if (process.env.configRootDir) configRootDir = process.env.configRootDir;

  if (process.env.config) {
    console.log('use env config : ' + process.env.config);
    envConfig = evaluate(process.env.config, null);
  }
  if (process.env.configFile) {
    console.log('use env config file : ' + process.env.config);
    envConfigFiles = process.env.config.split(',');
  }

  configRootDir = path.resolve(process.platform === 'win32' ? `C:/${configRootDir}` : `/etc/${configRootDir}`);
  console.log('root config dir : ' + configRootDir);

  //覆盖顺序：根目录配置(监视)<--代码内config<--其他预设文件<--项目专用配置
  // 目录(监视)<--其他预设文件(监视)<--环境变量指定配置文件(监视)
  // <--环境变量指定参数(监视)<--命令行指定配置文件(监视)<--命令行指定参数(监视)
  const configChains = [
    {item: argvConfig, watch: false},

    {item: envConfig, watch: false},

    {item: configRootDir, watch: true},

    {item: `${process.cwd()}/config`, watch: false},

    ...extendDefault.map(file => ({item: file, watch: false})),

    {item: loadWebConfig, watch: true},

    {item: `${configRootDir}/${project.name}`, watch: true},
    ...extendWatch.map(file => ({item: file, watch: true})),

    ...envConfigFiles.map(file => ({item: file, watch: true})),
    {item: envConfig, watch: false},

    ...argvConfigFiles.map(file => ({item: file, watch: true})),
    {item: argvConfig, watch: false},

    {item: {configRootDir}}
  ];

  return rebuildConfig(lodash.map(configChains, watchConfig));

}

/**
 * @param item    {*}
 * @param watch   {Boolean}
 */
function watchConfig({item, watch}) {
  let result;
  //如果是函数则返回函数运行结果
  if (typeof item === 'function') return item();
  //如果是对象或其他东西就直接返回本身
  if (typeof item === 'object') {
    lodash.merge(global.config, item);
    return item;
  }
  //无法定位到的文件
  if (!resolveFile(item))return null;

  if (watch) {
    console.log(`start watching file : ${item}`);
    result = watchModule(item, {}, (err, conf, oldConf) => {
      if (lodash.isEqual(conf, oldConf) || err) return;
      console.log(`${item} has change, reload.`);
      rebuildConfig();
    });
  } else {
    console.log(`loading config file : ${item}`);
    result = require(item);
  }

  lodash.merge(global.config, result);
  return result;

}

function rebuildConfig(configs) {
  if (configs) allConfigs = configs;

  const oldConf = lodash.cloneDeep(global.config);
  override(global.config, lodash.merge({}, ...allConfigs));
  configOnChange(global.config, oldConf);

  return global.config;
}

/**
 * 同步地获取webconfig，以及定时异步更新webconfig
 * @returns {Object}
 */
function loadWebConfig() {
  if (lodash.get(global, 'config.watchWebConfig', true)) {
    setInterval(function () {
      if (!global.config.webConfigUrl) return;

      rqAsync(global.config.webConfigUrl, {json: true, timeout: 5000})
        .then(function (result) {
          if (!(result && (result.code === 200 || result.code === 0))) return;
          if (lodash.isEqual(result.msg, webConfig)) return;

          console.log('web config has change, reload.');

          override(webConfig, result.msg);
          rebuildConfig();
        })
        .catch(err => console.warn('load webConfig error:', err.message || err));

    }, global.config.webConfigInterval || 10 * 1000);
  }

  if (!global.config.webConfigUrl) return webConfig;

  console.log('read webconfig on :', global.config.webConfigUrl);
  try {
    let result = rqSync(global.config.webConfigUrl, {json: true, timeout: 10000}).body;
    console.log('get webconfig msg :', result);
    if (!(result && (result.code === 200 || result.code === 0))) return webConfig;

    override(webConfig, result.msg);
    lodash.merge(global.config, result.msg);
  } catch (err) {
    console.error('load webConfig error:', err.message || err);
  }

  return webConfig;
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


module.exports = loadConfig;