/*
 * @Author: Matbin
 * @Date: 2023-11-21 13:51:04
 * @Description: 路由配置
 */

import { createRouter, createWebHistory } from 'vue-router'
import { h } from 'vue'

// 统一管理懒加载的组件路径，方便维护
const Music = () => import('../pages/music/music.vue')
const PlayList = () => import('../pages/music/playList.vue')
const Favorite = () => import('../pages/music/favorite.vue')
const FoundMusic = () => import('../pages/music/foundMusic.vue')
const HotPlayList = () => import('../pages/music/hotPlayList.vue')
const ArtistSongs = () => import('../pages/music/artistSongs.vue')
const PlaylistDetail = () => import('../pages/music/playlistDetail.vue')

/*
 * 音乐区落地页记忆。
 *
 * 第一次进 /music 走每日推荐；之后回到上次离开时停留的那一页。
 * 存 localStorage 而不是 pinia：路由模块不该反向依赖 store，避免循环引用；
 * 而且这个状态跟着设备走，刷新、重开浏览器都该保留。
 */
const LAST_MUSIC_PATH_KEY = 'music-player:last-music-path'
const FIRST_VISIT_PATH = '/music/foundMusic'

const isMusicPath = path => path === '/music' || path.startsWith('/music/')

const readLastMusicPath = () => {
  try {
    const saved = window.localStorage.getItem(LAST_MUSIC_PATH_KEY)
    // 只认 /music/ 开头的值，脏数据不至于把用户带到别的路由
    if (saved && saved.startsWith('/music/')) return saved
  } catch (error) {
    // 隐私模式下 localStorage 会抛错，当成首次访问处理
  }
  return FIRST_VISIT_PATH
}

const rememberMusicPath = path => {
  try {
    window.localStorage.setItem(LAST_MUSIC_PATH_KEY, path)
  } catch (error) {
    // 存不进去就退回默认页，不影响使用
  }
}

const routes = [
  {
    path: '/',
    name: 'home',
    meta: {
      menu: '主页'
    },
    // 主页由 App.vue 常驻渲染，这里只是占位，保证进 /music 时主页不被卸载
    component: { name: 'HomePlaceholder', render: () => h('div', { style: 'display:none' }) }
  },
  {
    path: '/music',
    name: 'music',
    redirect: () => readLastMusicPath(),
    meta: {
      menu: '音乐'
    },
    component: Music,
    children: [
      {
        path: 'playList',
        name: 'playList',
        meta: {
          menu: '搜索列表'
        },
        component: PlayList
      },
      {
        path: 'favorite',
        name: 'favorite',
        meta: {
          menu: '我的喜欢'
        },
        component: Favorite
      },
      {
        path: 'foundMusic',
        name: 'foundMusic',
        meta: {
          menu: '每日推荐'
        },
        component: FoundMusic
      },
      {
        path: 'hotPlayList',
        name: 'hotPlayList',
        meta: {
          menu: '热门歌单'
        },
        component: HotPlayList
      },
      {
        // 歌手热门：由歌曲列表/播放栏里的歌手名点击进入
        path: 'artist/:id',
        name: 'artistSongs',
        meta: {
          menu: '歌手热门',
          depth: 1
        },
        component: ArtistSongs
      },
      {
        // 歌单详情：由「热门歌单」卡片点击进入
        path: 'playlist/:id',
        name: 'playlistDetail',
        meta: {
          menu: '歌单详情',
          depth: 1
        },
        component: PlaylistDetail
      }
    ]
  },
  {
    // 兜底：未知路径回到首页，避免白屏
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    redirect: { name: 'home' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})
// 路由守卫：离开音乐区时记忆当前页，回到音乐区时恢复
router.afterEach((to, from) => {
  if (!isMusicPath(from.path) || from.name === 'music') return
  if (isMusicPath(to.path)) return
  rememberMusicPath(from.fullPath)
})

export default router
