/*
 * @Author: Matbin
 * @Date: 2023-11-21 13:51:04
 * @Description: vite配置
 * 
 */
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import net from 'node:net'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/*
 * 补丁：element-plus 滑块在拖动时会打印
 *   "Unable to preventDefault inside passive event listener invocation."
 *
 * 原因（上游 2.14.8 仍未修复）：
 *   slider.vue 里轨道的触摸事件绑定成 @touchstart.passive="onSliderDown"，
 *   而 onSliderDown 最终会调用 onButtonDown -> event.preventDefault()。
 *   被动监听里调用 preventDefault 是无效的，Chrome 每次触摸拖动都会告警一条。
 *
 * 处理：把编译产物里的 onTouchstartPassive 改回普通 onTouchstart，
 *   让 preventDefault 真正生效，告警随之消失。
 *   补丁只在命中目标文件时生效，上游若修复了这里会自动变成空操作。
 */
const SLIDER_FILE = /element-plus[\\/]es[\\/]components[\\/]slider[\\/]src[\\/]slider2\.mjs$/
/*
 * 注意：编译产物里这个标记出现两次 —— 一次是 vnode 的 props 键
 * （onTouchstartPassive: onSliderDown），一次是动态 props 数组里的字符串
 * （["onMousedown","onTouchstartPassive"]）。两处必须同时改，
 * 否则 Vue 更新时会去 patch 一个不存在的 prop，监听器就失效了。
 */
const SLIDER_PATCH_TARGET = 'onTouchstartPassive'
const SLIDER_PATCH_REPLACEMENT = 'onTouchstart'

const patchElementPlusSlider = code =>
  code.includes(SLIDER_PATCH_TARGET)
    ? code.replaceAll(SLIDER_PATCH_TARGET, SLIDER_PATCH_REPLACEMENT)
    : code

const elementPlusSliderPatch = () => ({
  name: 'patch-el-slider-passive-touchstart',
  enforce: 'pre',
  transform (code, id) {
    if (!SLIDER_FILE.test(id)) return null
    const patched = patchElementPlusSlider(code)
    return patched === code ? null : { code: patched, map: null }
  }
})

// 开发态依赖预构建走的是 esbuild，需要单独挂一个 onLoad 才能改到
const elementPlusSliderEsbuildPatch = () => ({
  name: 'patch-el-slider-passive-touchstart',
  setup (build) {
    build.onLoad({ filter: /slider2\.mjs$/ }, async args => {
      if (!SLIDER_FILE.test(args.path)) return null
      const code = await readFile(args.path, 'utf8')
      return { contents: patchElementPlusSlider(code), loader: 'js' }
    })
  }
})

/* ------------------------------------------------------------------
 * 开发态自动拉起网易云 API
 * 路径优先级：环境变量 NETEASE_API_DIR > 内置候选路径。
 * 换位置时设 NETEASE_API_DIR 即可，例如 PowerShell：
 *   $env:NETEASE_API_DIR="D:\path\to\NeteaseCloudMusicApi"; npm run dev
 * ------------------------------------------------------------------ */
const NETEASE_API_PORT = Number(process.env.NETEASE_API_PORT || 3000)
const NETEASE_API_CANDIDATES = [
  process.env.NETEASE_API_DIR,
  // 当前机器的实际位置（解压后多套了一层目录）
  'D:/User Data/Documents/MusicApi/NeteaseCloudMusicApi-master/NeteaseCloudMusicApi-master',
  'D:/User Data/Documents/MusicApi/NeteaseCloudMusicApi-master',
  // 兼容把 API 放在项目同级或项目内的常见情况
  join(process.cwd(), '../NeteaseCloudMusicApi'),
  join(process.cwd(), 'NeteaseCloudMusicApi'),
].filter(Boolean)

const resolveNeteaseApiDir = () =>
  NETEASE_API_CANDIDATES.find(dir => existsSync(join(dir, 'app.js')))

// 端口探活：能连上就认为已经有服务在跑
const isPortOpen = port => new Promise(resolve => {
  const socket = net.connect({ port, host: '127.0.0.1' })
  let settled = false
  const done = open => {
    if (settled) return
    settled = true
    socket.destroy()
    resolve(open)
  }
  socket.once('connect', () => done(true))
  socket.once('error', () => done(false))
  socket.setTimeout(600, () => done(false))
})

// Windows 下 child.kill() 只结束父进程，用 taskkill /T 连子进程一起收掉
const killChild = child => {
  if (!child || child.killed) return
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      detached: true
    })
    killer.unref()
  } else {
    child.kill()
  }
}

/*
 * Vite 冷启动/依赖预构建时 configureServer 可能被调用不止一次，
 * 而且重载配置会重新求值本模块、把模块级变量重置。
 * 所以标记挂在 globalThis 上（同一进程内共享），才能真正防止重复 spawn 撞端口。
 */
const getApiChild = () => globalThis.__neteaseApiChild || null
const setApiChild = child => { globalThis.__neteaseApiChild = child }

const neteaseApiPlugin = () => ({
  name: 'netease-api-dev-server',
  // 只在 dev 生效，build 不会去拉 API
  apply: 'serve',
  async configureServer (server) {
    const logger = server.config.logger
    // 注意别写 logger?.info?.(msg) ?? console.log(msg)：
    // logger.info 返回 undefined，?? 会继续执行右边的 console.log，导致每条日志打印两遍
    const info = msg => { if (logger?.info) logger.info(msg); else console.log(msg) }
    const warn = msg => { if (logger?.warn) logger.warn(msg); else console.warn(msg) }
    const error = msg => { if (logger?.error) logger.error(msg); else console.error(msg) }

    // 本进程已经拉起过，直接跳过
    const existing = getApiChild()
    if (existing && existing.exitCode === null && !existing.killed) return

    /*
     * 并发保护：configureServer 可能被同时调用两次，两次都会先 await 端口探活。
     * 不先占位的话，它们会同时通过检查、各 spawn 一个进程（第二个撞端口）。
     * 标记放在 globalThis 上，避免 Vite 重载配置时被重置。
     */
    if (globalThis.__neteaseApiSpawning) return
    globalThis.__neteaseApiSpawning = true

    try {
      if (await isPortOpen(NETEASE_API_PORT)) {
        if (!globalThis.__neteaseApiReuseLogged) {
          info(`[netease-api] 端口 ${NETEASE_API_PORT} 已有服务，直接复用`)
          globalThis.__neteaseApiReuseLogged = true
        }
        return
      }

      const apiDir = resolveNeteaseApiDir()
      if (!apiDir) {
        warn('[netease-api] 未找到 NeteaseCloudMusicApi，跳过自动启动（可用 NETEASE_API_DIR 指定路径）')
        return
      }
      if (!existsSync(join(apiDir, 'node_modules'))) {
        warn(`[netease-api] ${apiDir} 缺少 node_modules，请先在该目录执行 npm install`)
        return
      }

      info(`[netease-api] 启动中：${apiDir}`)
      const child = spawn(process.execPath, ['app.js'], {
        cwd: apiDir,
        stdio: 'inherit',
        env: { ...process.env, PORT: String(NETEASE_API_PORT) }
      })
      setApiChild(child)
      child.on('error', err => {
        setApiChild(null)
        error(`[netease-api] 启动失败：${err.message}`)
      })
      child.on('exit', (code, signal) => {
        setApiChild(null)
        if (code && code !== 0) warn(`[netease-api] 进程退出 code=${code} signal=${signal || ''}`)
      })

      /*
       * 只在开发服务器进程真正退出时清理。
       * 不在 httpServer close 时清理：Vite 改配置会重启 dev server，
       * 那时端口可能还没释放，新实例会误判「已有服务」而不再启动。
       */
      const cleanup = () => killChild(child)
      process.once('exit', cleanup)
      process.once('SIGINT', cleanup)
      process.once('SIGTERM', cleanup)
    } finally {
      globalThis.__neteaseApiSpawning = false
    }
  }
})

/*
 * /api 代理：dev 与 preview 共用同一份配置。
 * 这样 `npm run preview` 打开构建产物时接口也能通，上线前可以直接在本地验证打包结果。
 */
const apiProxy = {
  '/api/': {
    target: `http://localhost:${NETEASE_API_PORT}`,
    changeOrigin: true,
    rewrite: path => path.replace(/^\/api/, '')
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), elementPlusSliderPatch(), neteaseApiPlugin()],
  /*
   * 部署到根域名（https://music.example.com/）保持 '/'；
   * 部署到子路径（https://example.com/music/）改成 '/music/'，
   * 同时 router 里 createWebHistory() 要传同一个前缀，否则静态资源会 404。
   */
  base: '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [elementPlusSliderEsbuildPatch()]
    }
  },
  build: {
    // 拆包：把体积大且不常变的依赖单独打出来，避免业务代码一改就全量失效
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia', 'pinia-plugin-persistedstate'],
          'element-plus': ['element-plus'],
          gsap: ['gsap']
        }
      }
    }
  },
  server: {
    proxy: apiProxy
  },
  preview: {
    proxy: apiProxy
  }
})
