/*
 * Vercel Serverless 入口
 *
 * 放置位置：NeteaseCloudMusicApi 仓库根目录下的 api/index.js
 *
 * 为什么需要它：
 * 仓库自带的 app.js 只是调用 serveNcmApi() 并监听一个端口，没有导出 handler。
 * 常驻进程这样没问题，但 Serverless 要求模块导出一个 (req, res) 函数。
 * 这里把 Express 实例缓存起来复用（Vercel 会复用热实例），再手动交给 Express 处理。
 *
 * 用法：
 *   1. 在 GitHub 上 fork 的仓库里新建文件 api/index.js，粘贴本文件内容
 *   2. 同时把根目录的 vercel.json 换成同目录下的那份配置
 *   3. Vercel 重新部署
 */
const { serveNcmApi } = require('../server')

// 同一个函数实例会被复用，app 只初始化一次：
// 既避免每次请求重复构造，也避免重复 listen 报 EADDRINUSE
let appPromise = null

const getApp = () => {
  if (!appPromise) {
    appPromise = serveNcmApi({
      // 关掉版本检查：它会去请求 npm registry，在冷启动里只会拖慢首次响应
      checkVersion: false,
      // serveNcmApi 内部一定会 listen，随便给个非特权端口让它成功即可；
      // Serverless 里这个监听没有实际作用，请求由上面的 handler 接管
      port: 3001
    })
  }
  return appPromise
}

module.exports = async (req, res) => {
  const app = await getApp()
  // Express 实例本身就是一个 (req, res, next) 函数
  return app(req, res)
}
