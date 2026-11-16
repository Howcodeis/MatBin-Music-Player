/*
 * PM2 进程守护配置（网易云 API）
 *
 * 用法：
 *   npm i -g pm2
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 save
 *   pm2 startup          # 按提示复制执行它给出的那条命令，实现开机自启
 *
 * 查看日志：pm2 logs netease-api
 * 重启：    pm2 restart netease-api
 */
module.exports = {
  apps: [
    {
      name: 'netease-api',
      // 改成你服务器上 API 的实际目录
      cwd: '/opt/netease-api',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      // 超过这个内存就自动重启，防止长时间跑出内存泄漏
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        /*
         * 只监听回环地址。该服务默认什么都不传时会绑 0.0.0.0，
         * 等于公网任何 IP 都能直接调你的接口 —— 公开站点这是大忌。
         * 绑 127.0.0.1 后只有本机 Nginx 能访问，外部一律连不上。
         * （server.js 里是 `options.host || process.env.HOST || ''`，支持这个变量）
         */
        HOST: '127.0.0.1'
      },
      out_file: '/var/log/netease-api/out.log',
      error_file: '/var/log/netease-api/error.log',
      merge_logs: true,
      time: true
    }
  ]
}
