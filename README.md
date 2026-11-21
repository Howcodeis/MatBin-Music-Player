# 🎵 MatBin Music Player

> 一个基于 **Vue 3** 的网易云音乐 Web 播放器。界面克制、交互顺滑，专注「找歌 → 听歌 → 看歌词」这条主线。

[![Vue 3](https://img.shields.io/badge/Vue-3.3-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Pinia](https://img.shields.io/badge/Pinia-2-FFD859?logo=pinia&logoColor=black)](https://pinia.vuejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

🔗 **在线预览**：<https://131202914.xyz>

---

## ✨ 功能特性

- 🔍 **找歌**：歌曲 / 歌手搜索、每日推荐、热门歌单、官方榜单、歌单详情、歌手热门
- 🎧 **听歌**：播放 / 暂停、上下曲、多种播放模式、进度拖动，收藏与搜索历史本地留存
- 📝 **看歌词**：自研 LRC 解析动画、官方翻译对齐、逐句高亮、点击跳转，还有底部评论气泡
- 🎨 **体验**：封面驱动的沉浸式背景、GSAP 动效、响应式布局，桌面与移动端皆宜
- ⚡ **工程细节**：dev 一键拉起本地 API、按需加载组件、防抖持久化，播放顺滑不卡顿

## 🛠️ 技术栈

| 分类 | 技术 |
| --- | --- |
| 框架 | Vue 3（`<script setup>`）+ Vue Router 4 |
| 构建 | Vite 5 |
| 状态 | Pinia + pinia-plugin-persistedstate |
| UI / 样式 | Element Plus · Tailwind CSS · 本地 iconfont |
| 动画 / 网络 | GSAP · Axios · nprogress |
| 数据源 | [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)（本地服务，非项目内置后端） |

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动（自动探活并拉起本地 3000 端口的网易云 API）
npm run dev
```

> 需要本机已准备好 [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) 并安装其依赖。若目录不同，用环境变量指定：
>
> ```bash
> NETEASE_API_DIR="D:/path/to/NeteaseCloudMusicApi" npm run dev
> ```

```bash
npm run build      # 生产构建
npm run preview    # 预览构建产物
```

## 📁 目录结构

```
src/
├── main.js / App.vue      # 入口与全局壳层
├── router/                # 路由（页面懒加载）
├── store/                 # 播放核心与全局状态
├── api/                   # 接口请求与数据清洗
├── utils/                 # 纯函数工具（歌词解析、动画、存储等）
├── composables/           # 视图级组合式逻辑
├── pages/                 # 首页 + 音乐主界面及各子页
└── assets/                # 封面、图标、全局样式
```

## 📖 更多

想深入了解接口清单、工程实现细节与已知限制？移步 [详细技术档案](docs/README-详细版.md)。

## ⚠️ 说明

本项目为个人学习与练习之作，数据来自 NeteaseCloudMusicApi，**仅供学习交流，请勿用于商业用途**。部分版权 / 高音质资源可能无法获取播放地址，播放器会自动跳过。

---

*Made with ♫ by Matbin*
