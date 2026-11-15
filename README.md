# 简约风音乐播放器 · 项目介绍

> 一个基于 Vue 3 的网易云音乐 Web 播放器。界面克制、内容密度高，重点放在「找歌 → 听歌 → 看歌词」这条主链路的顺滑度上。
>
> 数据来自 [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)，项目本身不含后端；目前为个人开发 / 练习阶段，仅用于学习交流。
>

---

## 一、它长什么样

整个音乐界面是一块**居中的深色半透明圆角面板**，浮在固定的插画底图之上。面板内部用当前歌曲封面放大、模糊、压暗后作为背景

- 图标全部来自项目自带的 `iconfont.css`，没有引入第三方图标库；
- 动效统一交给 GSAP
- 布局用 Tailwind 原子类，局部复杂样式（歌词、评论气泡、背景过渡）用 scoped CSS；

---

## 二、核心特色

### 1. 找歌：四条入口，互不混淆

### 2. 听歌

播放器核心是一个全局复用的原生 `HTMLAudioElement` + Pinia 状态，控制栏提供：

稳定性上做了不少针对性处理：

### 3. 看歌词：解析、翻译、动画、评论

- 自己实现的 LRC 解析：支持一行多时间戳、排序去重、`offset` 偏移，输出后按时间升序，供播放器用**二分查找**定位当前句；
- 官方中文翻译（`tlyric`）按时间戳对齐挂到每行 `tword`，容差 0.6s，无时间轴时按行号对齐；
- 歌词切换用 GSAP 做前后两句交叉淡变；
- 大字模式与滚动模式共用底部评论区：6 条胶囊气泡、显示点赞数、本地翻页（不发请求）；点击歌词可跳到对应时间。

### 4. 工程层面的讲究

- **一条命令听歌**：`vite.config.js` 里有个 `apply: 'serve'` 插件，dev 启动时先探活 3000 端口 —— 已有服务就复用，没有就 `spawn` 拉起本地 API，退出时用 `taskkill /pid /T /F` 只清理自己拉起的进程树。路径 / 端口可用 `NETEASE_API_DIR`、`NETEASE_API_PORT` 覆盖。
- **构建期补丁**：Element Plus 2.x 的 slider 把 `touchstart` 绑成 passive，却在处理函数里调 `preventDefault`，Chrome 每次触摸拖动都打一条 intervention 告警。项目在 Vite `transform`（生产）和 `optimizeDeps` 的 esbuild `onLoad`（dev 预构建）两处替换掉该标记；上游修好后正则不命中，补丁自动失效。
- **持久化不拖慢播放**：`ontimeupdate` 每 100ms 写一次进度，直接全量 persist 会把约 119KB 状态每秒同步序列化 10 次。改用自定义 `debouncedLocalStorage`（800ms 防抖 + `pagehide` / 页面隐藏时立即落盘）。
- **体积**：Element Plus 只按需注册实际用到的 5 个组件；`manualChunks` 把 vue / element-plus / gsap 拆成独立 chunk。
- **分层清晰**：`utils/` 放零依赖纯函数 → `api/` 只管请求与数据清洗 → `composables/` 放不进 localStorage 的视图状态 → `store/` 管全局播放状态 → `pages/` 管页面。

---

## 三、技术栈

| 层次 | 技术 | 版本 | 用途 |
| --- | --- | --- | --- |
| 框架 | Vue 3 | ^3.3.8 | `<script setup>` + Composition API |
| 构建 | Vite 5 / @vitejs/plugin-vue 4 | ^5.0.0 / ^4.5.0 | 开发服务器、代理、构建期插件、手动拆包 |
| 路由 | Vue Router 4 | ^4.2.5 | `createWebHistory`、`/music` 嵌套路由、组件懒加载、404 兜底 |
| 状态 | Pinia 2 + pinia-plugin-persistedstate 3 | ^2.1.7 / ^3.2.0 | 播放状态 / 歌单 / 收藏，配自定义防抖 storage 持久化 |
| UI 组件 | Element Plus 2 | ^2.4.2 | 按需注册 `ElTable` / `ElTableColumn` / `ElSlider` / `ElRow` / `ElCol` |
| 列表触底 | el-table-infinite-scroll | ^3.0.3 | 表格内部滚动容器的无限加载指令 |
| 样式 | Tailwind CSS 3 + PostCSS + Autoprefixer | ^3.3.5 | 原子类布局，局部复杂样式用 scoped CSS |
| 动画 | GSAP 3 | ^3.12.2 | 路由过渡、面板 / 抽屉、歌词交叉淡变 |
| 网络 | Axios 1.6 + nprogress | ^1.6.2 / ^0.2.0 | 统一 `baseURL: '/api/'`、拦截器、顶部加载进度条 |
| 图标 | 本地 iconfont | — | `src/assets/iconfont.css`，无外部图标依赖 |
| 音频 | 原生 HTMLAudioElement | — | 单例音频对象，`ontimeupdate` 驱动进度与歌词 |
| 后端 | NeteaseCloudMusicApi（Node.js） | — | 本地 3000 端口，提供网易云数据接口 |

浏览器原生能力还用到：`localStorage`（收藏 / 搜索历史 / 状态持久化）、`matchMedia`（响应式与 hover 能力探测）、`new Image()`（封面预加载）、`<Transition>`（背景交叉淡变）。

---

## 四、目录结构

```
blog/
├── vite.config.js          # 代理、拆包、Element Plus 补丁、API 一键启动插件
├── tailwind.config.js / postcss.config.js
├── src/
│   ├── main.js             # 入口：Pinia + 持久化插件 + 按需注册组件
│   ├── App.vue             # 固定底图 + GSAP 路由过渡
│   ├── router/             # 路由表（懒加载 pages/*）
│   ├── store/index.js      # 播放核心：音频对象、切歌竞态、歌词同步、各列表状态
│   ├── api/
│   │   ├── reqMusic.js     # 网易云接口请求封装（10 个端点 / 11 个方法）
│   │   └── musicService.js # code 校验 + 返回数据清洗
│   ├── utils/
│   │   ├── music.js        # 播放模式常量、上下首索引、时间格式化
│   │   ├── lyric.js        # LRC 解析、翻译对齐
│   │   ├── gsapTools.js    # 面板 / 抽屉动画封装
│   │   ├── storage.js      # 防抖 localStorage 适配器
│   │   └── MessageBack.js  # ElMessage / ElNotification 封装
│   ├── composables/        # 搜索历史、收藏筛选、歌手筛选、滚动记忆、响应式
│   ├── pages/
│   │   ├── home/           # 首页
│   │   └── music/          # 音乐主界面 + 6 个子页面 + controls / searchBar / 歌词板
│   └── assets/             # 默认封面、iconfont、全局样式
└── _backup/                # 历次重构前的源码快照（已 gitignore）
```

路由：`/`（首页）、`/music` 重定向到 `/music/playList`，子路由 `playList`、`favorite`、`foundMusic`、`hotPlayList`、`artist/:id`、`playlist/:id`，未知路径回首页。

---

## 五、接口一览

所有请求走 `/api/*`，由 Vite 代理到 `http://localhost:3000` 并去掉 `/api` 前缀。

| 端点 | 用途 |
| --- | --- |
| `/cloudsearch` | 搜索歌曲 |
| `/song/url` | 播放地址；无版权时返回 `data:[{url:null}]` |
| `/song/detail` | 封面、专辑（单首与批量补图共用） |
| `/lyric` | 原词 + 官方翻译 |
| `/comment/music` | 歌词页底部评论 |
| `/artist/songs` | 歌手热门歌曲（支持分页） |
| `/personalized` | 推荐歌单 |
| `/recommend/songs` | 每日推荐 |
| `/playlist/detail` | 歌单元信息 |
| `/playlist/track/all` | 歌单内歌曲（分页） |

---

## 六、本地运行

```bash
npm install
npm run dev        # Vite 默认 5173，同时自动探活 / 拉起 3000 端口的网易云 API
```

需要本地已解压 NeteaseCloudMusicApi 且装好它自己的 `node_modules`。换位置时用环境变量：

```bash
NETEASE_API_DIR="D:/path/to/NeteaseCloudMusicApi" npm run dev   # macOS / Linux / Git Bash
# PowerShell:
$env:NETEASE_API_DIR="D:\path\to\NeteaseCloudMusicApi"; npm run dev
```

```bash
npm run build      # 生产构建
npm run preview    # 预览构建产物
```

---

## 七、已知限制

- 依赖本地 NeteaseCloudMusicApi；未接登录，每日推荐是免登录的通用日推，部分版权 / 高音质资源会拿不到地址（此时播放器会自动跳过）。
- `vite preview` 没配 `preview.proxy`，要实际听歌请用 `npm run dev`；部署到线上需要自行配置 `/api` 反向代理。
- 接口返回的播放地址可能是 `http://`，若部署在 https 站点会被浏览器按混合内容拦截，需要服务端转换或代理。
- API 目录目前优先用硬编码的本机路径，他人拉取后需设 `NETEASE_API_DIR`。
- 部分组件仍有 `import { defineOptions } from 'vue'`，编译器会提示它是 macro、无需导入（不影响运行）。
- 项目处于持续开发阶段，仓库内尚未内置自动化测试脚本；关键链路此前用无头 Edge + CDP 拦截接口做过端到端验证。

---

*整理时间：2026-11-15*
