#!/usr/bin/env node
/*
 * 入口文件
 *
 * 关键点（都是踩过的坑，别改回去）：
 *
 * 1) 必须真正 listen，不能只导出 handler。
 *    Passenger / LiteSpeed 是通过 hook `http.Server.prototype.listen`
 *    把应用接管到自己的 socket 上的。只导出 handler 而不 listen 时，
 *    Node 进程没有挂起句柄会直接退出，Passenger 拿不到可用进程 → 503。
 *
 * 2) 同时导出 handler，兼容「LSAPI 直接调用导出函数」的模式。
 *    两套机制并存不冲突：一个请求只会走其中一条路径。
 *
 * 3) 不要再硬编码 app.listen(3000)。
 *    PORT 由服务器注入，可能是数字，也可能是 unix socket 路径；
 *    具体转换在 server.js 里（只有纯数字字符串才转 Number）。
 *
 * 4) /api 前缀的剥离放在 server.js 的中间件里，
 *    这样无论请求从 listen 进来还是从导出的 handler 进来，都能生效。
 */
const { serveNcmApi } = require('./server')

// 内部会按端口/路径规则 listen；关掉版本检查，避免启动时访问 npm registry
const appPromise = serveNcmApi({ checkVersion: false })

module.exports = async (req, res) => {
  const app = await appPromise
  return app(req, res)
}
