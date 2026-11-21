<script setup>
import { defineOptions, onMounted, provide } from 'vue'
import gsap from 'gsap'
import Home from './pages/home/home.vue'
import { musicStatus } from './store'
import { playProgress, persistProgress } from './utils/playProgress'
// 主页改纯色后暂时不用这张图；恢复背景图时放开
// import defaultCover from '@/assets/image/109951173012411790.jpg'

defineOptions({
  name: 'App'
})

const store = musicStatus()

// 背景图已停用，主页走纯色；恢复背景图时把这个和模板里的 bg-fade 一起放开
// const bgReady = ref(false)

// 软键盘弹出会改 innerHeight 把 controls 压扁，聚焦输入框期间锁住高度
const HEIGHT_VAR = '--app-height'
let inputFocused = false

const applyAppHeight = height => {
  document.documentElement.style.setProperty(HEIGHT_VAR, `${height}px`)
}

const syncViewportHeight = () => {
  const height = window.innerHeight
  if (!height) return
  if (inputFocused) return
  applyAppHeight(height)
}

const isTextField = el => Boolean(el) && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')

// 音乐页才有进度条容器，用它区分是不是音乐页
const isMusicPage = el => Boolean(el?.querySelector?.('#audioSchedule'))

let musicEl = null
let closingManually = false

// 手动收起时先播完动画再跳路由，避免面板先变空
provide(
  'closeMusic',
  () =>
    new Promise(resolve => {
      if (!musicEl) {
        resolve()
        return
      }
      closingManually = true
      musicEl.style.willChange = 'transform, opacity'
      gsap.to(musicEl, {
        yPercent: 100,
        scale: 0,
        opacity: 0,
        duration: 0.22,
        ease: 'power2.in',
        force3D: true,
        onComplete: () => {
          musicEl.style.willChange = ''
          musicEl = null
          resolve()
        }
      })
    })
)

// 音乐页从底部升起、同时放大，最后停在原本的位置
const onPageEnter = (el, done) => {
  if (!isMusicPage(el)) {
    done()
    return
  }
  musicEl = el
  el.style.zIndex = '2'
  // 页面里 DOM 很多，动画期间提层，避免每帧重绘整页
  el.style.willChange = 'transform, opacity'
  gsap.fromTo(
    el,
    { yPercent: 100, scale: 0, opacity: 0 },
    {
      yPercent: 0,
      scale: 1,
      opacity: 1,
      duration: 0.3,
      ease: 'power3.out',
      force3D: true,
      onComplete: () => {
        el.style.willChange = ''
        done()
      }
    }
  )
}

// 关闭时反向：缩小、落回底部
const onPageLeave = (el, done) => {
  if (!isMusicPage(el)) {
    done()
    return
  }
  // 动画已经提前播过，这里直接放行
  if (closingManually) {
    closingManually = false
    done()
    return
  }
  el.style.willChange = 'transform, opacity'
  gsap.to(el, {
    yPercent: 100,
    scale: 0,
    opacity: 0,
    duration: 0.22,
    ease: 'power2.in',
    force3D: true,
    onComplete: () => {
      el.style.willChange = ''
      done()
    }
  })
}

onMounted(() => {
  store.initAudio()
  syncViewportHeight()

  window.addEventListener('resize', syncViewportHeight)
  window.addEventListener('orientationchange', syncViewportHeight)

  document.addEventListener('focusin', event => {
    if (isTextField(event.target)) inputFocused = true
  })
  document.addEventListener('focusout', event => {
    if (!isTextField(event.target)) return
    inputFocused = false
    syncViewportHeight()
  })

  // 离开页面 / 切后台时把播放进度落盘，下次进来接着听
  const savePlayProgress = () => persistProgress(store.currentMusicInfo?.id, playProgress.value)
  window.addEventListener('pagehide', savePlayProgress)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') savePlayProgress()
  })

  // 首屏立刻预取音乐区，不等空闲——点「进入」时 chunk 没下会像卡住
  import('./pages/music/music.vue')
  import('./pages/music/foundMusic.vue')
  import('./pages/music/playList.vue')
  import('./pages/music/favorite.vue')
  import('./pages/music/hotPlayList.vue')
  import('./pages/music/charts.vue')
  import('./pages/music/artistSongs.vue')
  import('./pages/music/playlistDetail.vue')

  // 背景图预加载已停用（主页改纯色），恢复背景图时一起放开
  // const bg = new Image()
  // bg.onload = () => {
  //   bgReady.value = true
  // }
  // bg.src = defaultCover
})
</script>

<template>
  <div class="w-full body flex items-center justify-center">
    <!-- 主页改纯色，背景图暂时不用。要恢复就把这段和 bgReady、图片预加载一起放开
    <div
      class="bg-fade"
      :class="{ 'is-ready': bgReady }"
      :style="{ backgroundImage: `url(${defaultCover})` }"
    ></div>
    -->
    <!-- 主页常驻，音乐页升起来时它一直在下面 -->
    <Home />

    <router-view v-slot="{ Component }">
      <Transition :css="false" @enter="onPageEnter" @leave="onPageLeave">
        <KeepAlive :max="4">
          <component :is="Component" />
        </KeepAlive>
      </Transition>
    </router-view>
  </div>
</template>

<style scoped>
.body {
  height: var(--app-height, 100vh);
  background-color: #323737;
  position: relative;
  isolation: isolate; /* 独立层叠上下文，免得背景层被深色底盖住 */
}

/* 背景图图层已停用（主页改纯色），恢复背景图时一起放开
.bg-fade {
  position: absolute;
  inset: 0;
  z-index: -1;
  background-size: cover;
  background-position: center;
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
}

.bg-fade.is-ready {
  opacity: 1;
}
*/

.body::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 0;
}
</style>
