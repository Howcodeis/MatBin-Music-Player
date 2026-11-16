/*
 * @Author: Matbin
 * @Date: 2023-11-21 13:51:04
 * @Description: 路由配置
 */

import { createRouter, createWebHistory } from 'vue-router'

// 统一管理懒加载的组件路径，方便维护
const Home = () => import('../pages/home/home.vue')
const Music = () => import('../pages/music/music.vue')
const PlayList = () => import('../pages/music/playList.vue')
const Favorite = () => import('../pages/music/favorite.vue')
const FoundMusic = () => import('../pages/music/foundMusic.vue')
const HotPlayList = () => import('../pages/music/hotPlayList.vue')
const ArtistSongs = () => import('../pages/music/artistSongs.vue')
const PlaylistDetail = () => import('../pages/music/playlistDetail.vue')

const routes = [
  {
    path: '/',
    name: 'home',
    meta: {
      menu: '主页'
    },
    component: Home,
  },
  {
    path: '/music',
    name: 'music',
    redirect: "/music/foundMusic",
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
        component: PlayList,
      },
      {
        path: 'favorite',
        name: 'favorite',
        meta: {
          menu: '我的喜欢'
        },
        component: Favorite,
      },
      {
        path: 'foundMusic',
        name: 'foundMusic',
        meta: {
          menu: '每日推荐'
        },
        component: FoundMusic,
      },
      {
        path: 'hotPlayList',
        name: 'hotPlayList',
        meta: {
          menu: '热门歌单'
        },
        component: HotPlayList,
      },
      {
        // 歌手热门：由歌曲列表/播放栏里的歌手名点击进入
        path: 'artist/:id',
        name: 'artistSongs',
        meta: {
          menu: '歌手热门'
        },
        component: ArtistSongs,
      },
      {
        // 歌单详情：由「热门歌单」卡片点击进入
        path: 'playlist/:id',
        name: 'playlistDetail',
        meta: {
          menu: '歌单详情'
        },
        component: PlaylistDetail,
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

export default router
