<script setup>
import { musicStatus } from '@/store'
import { storeToRefs } from 'pinia'
import { defineOptions, onActivated, onMounted, onUnmounted, ref, watch } from 'vue'

defineOptions({
  name: 'LyricPanel'
})

const props = defineProps({
  isShowScrollLyrics: {
    type: Boolean,
    default: false
  }
})
const { currentMusicInfo, getCurrentLyricIndex, getIsShowSPLyricsPanel } =
  storeToRefs(musicStatus())
// 歌词面板
const lyricBoard = ref(null)

// 行中心对齐容器中心；不能用 offsetTop，它相对的是外层容器不是 ul
const lyricMove = (smooth = true) => {
  const board = lyricBoard.value
  if (!board) return
  const index = getCurrentLyricIndex.value
  const target = index >= 0 ? board.children[index] : null
  if (!target) return
  const boardRect = board.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const center = targetRect.top + targetRect.height / 2 - boardRect.top + board.scrollTop
  board.scrollTo({
    top: Math.max(center - board.clientHeight / 2, 0),
    behavior: smooth ? 'smooth' : 'auto'
  })
}
// 用户手动滚动后 3 秒内不抢滚动
let timer
let isLyricMove = true
const handleMove = () => {
  isLyricMove = false
  clearTimeout(timer)
  timer = setTimeout(() => {
    isLyricMove = true
    lyricMove()
  }, 3000)
}
// 等 active 类落到 DOM 上再算，否则字号还没生效
watch(
  getCurrentLyricIndex,
  () => {
    if (isLyricMove) lyricMove()
  },
  { flush: 'post' }
)
watch([getIsShowSPLyricsPanel, () => props.isShowScrollLyrics], () => {
  if (getIsShowSPLyricsPanel.value && props.isShowScrollLyrics) {
    timer = setTimeout(() => {
      lyricMove()
    }, 500)
  }
})
// 跳到指定歌词
const skipLyric = lyric => {
  musicStatus().skipByLyric(lyric?.time)
}

// 进来先定位：等列表渲染完再算，用独立 timer 不碰滚动的
let relocateTimer
const relocate = () => {
  clearTimeout(relocateTimer)
  relocateTimer = setTimeout(() => lyricMove(), 300)
}

// 尺寸一变就重算；必须瞬间定位，smooth 会被拖动反复打断，看着像滞后
let ro = null
onMounted(() => {
  relocate()
  const host = lyricBoard.value?.parentElement
  if (host) {
    ro = new ResizeObserver(() => lyricMove(false))
    ro.observe(host)
  }
})
// KeepAlive 回来不会重新挂载，补一次
onActivated(relocate)

onUnmounted(() => {
  clearTimeout(timer)
  clearTimeout(relocateTimer)
  ro?.disconnect()
  ro = null
})
</script>

<template>
  <!-- 歌词部分 -->
  <div class="flex justify-center h-full w-full md:w-[60%] overflow-hidden">
    <!-- 文字在模糊背景下滚动导致背景失真，出现块状问题 添加will-change-scroll 解决 -->
    <ul
      ref="lyricBoard"
      class="lyric-board overflow-y-scroll w-[80%] h-full will-change-scroll"
      @wheel="handleMove"
      @touchmove="handleMove"
    >
      <li
        v-for="(lyric, index) in currentMusicInfo.lyric"
        :key="index"
        class="cursor-pointer leading-relaxed my-4 text-center text-slate-400 transition-colors duration-300 will-change-transform"
        :class="[index == getCurrentLyricIndex ? 'active' : '']"
        @click.stop="skipLyric(lyric)"
      >
        <div>{{ lyric.word }}</div>
        <!-- 官方翻译歌词，只有接口给了 tlyric 才渲染 -->
        <div v-if="lyric.tword" class="tword">{{ lyric.tword }}</div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/*
 * 首尾留白用伪元素，不用 padding：
 * padding 会计入 border-box 高度，上下各半屏等于整个高度，
 * 会把滚动容器撑高、不再跟随父级。
 */
.lyric-board::before,
.lyric-board::after {
  content: '';
  display: block;
  height: 50%;
}

.active {
  color: aliceblue;
  font-size: 1.1rem;
}

.tword {
  margin-top: 0.15rem;
  font-size: 0.85em;
  color: #94a3b8;
}

.active .tword {
  color: rgba(240, 249, 255, 0.78);
}
</style>
