# wheel
日常工作造的各种轮子，应该跟业务没有任何关系  
应该位于项目的node_modules文件夹内，避免在不同地方引用找不到路径  

## 背景
项目使用services/config模块，并将config挂载到global上，并且确保自身目录下有package.json

## 分类
纯工具类在tools目录，可能与业务有紧密关联的肮脏代码在services目录
