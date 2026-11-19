<script setup>
import { musicStatus } from '@/store'
import { storeToRefs } from 'pinia'
import { defineOptions, onMounted, onUnmounted, ref, watch } from 'vue'

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
// 歌词偏移量
const lyricMove = () => {
  const board = lyricBoard.value
  if (!board) return
  const index = getCurrentLyricIndex.value
  // 索引为 -1（还没进入第一句）时没有目标行
  const target = index >= 0 ? board.children[index] : null
  if (!target) return
  // offsetTop 为 0 是第一行合法的情况，不能用 !offsetTop 判断
  const offset = target.offsetTop - board.offsetHeight * 0.5
  board.scrollTo({ top: Math.max(offset, 0), behavior: 'smooth' })
}
// 监听鼠标滚动时间
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
watch(getCurrentLyricIndex, () => {
  if (isLyricMove) lyricMove()
})
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

onUnmounted(() => {
  clearTimeout(timer)
})
onMounted(() => {
  if (getIsShowSPLyricsPanel.value && props.isShowScrollLyrics) {
    timer = setTimeout(() => {
      lyricMove()
    }, 500)
  }
})
</script>

<template>
  <!-- 歌词部分 -->
  <div class="flex justify-center h-full w-full md:w-[60%] overflow-hidden">
    <!-- 文字在模糊背景下滚动导致背景失真，出现块状问题 添加will-change-scroll 解决 -->
    <ul
      ref="lyricBoard"
      class="overflow-y-scroll pt-[12rem] w-[80%] h-full will-change-scroll"
      @wheel="handleMove"
      @touchmove="handleMove"
    >
      <li
        v-for="(lyric, index) in currentMusicInfo.lyric"
        :key="index"
        class="cursor-pointer leading-relaxed my-4 text-center text-slate-400 duration-300 will-change-transform"
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
