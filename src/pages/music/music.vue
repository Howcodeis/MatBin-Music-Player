<script setup>
import { computed, defineOptions, inject, nextTick, provide, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import controls from './components/controls.vue'
import MusicLayout from './MusicLayout.vue'
import soloPage from './components/lyricBoard/soloPage.vue'
import { musicStatus } from '@/store'
import { storeToRefs } from 'pinia'
import { normalBack } from '@/utils/MessageBack'
import { PanelShowY, PanelHideY } from '@/utils/gsapTools'
import { toThumb } from '@/utils/music'
import defaultCover from '@/assets/image/109951173012411790.jpg'

defineOptions({
  name: 'MusicPage'
})

const { isShowAnimationLyrics, currentMusicInfo, lyricsOpenRequest } = storeToRefs(musicStatus())

const closeMusic = inject('closeMusic', null)

// 回主页先播完收起动画再放路由，否则面板会先变空再动
onBeforeRouteLeave(async to => {
  if (to.name !== 'home' || !closeMusic) return true
  try {
    await closeMusic()
  } catch (error) {
    // 动画出错也不拦着导航
  }
  return true
})

const isShowSiderMenu = ref(false)
const showSiderMenu = () => {
  isShowSiderMenu.value = !isShowSiderMenu.value
}
// 移动端抽屉：状态与开关一起下发，列表页据此渲染覆盖式侧栏
provide('siderMenu', { isShowSiderMenu, showSiderMenu })

const listPage = ref(null)
const soloItem = ref(null)

const toggleLyricBoard = () => {
  if (!currentMusicInfo.value.cover && !currentMusicInfo.value.url) {
    normalBack('info', '当前没有播放的歌曲')
    return
  }
  if (!isShowAnimationLyrics.value) {
    PanelHideY(listPage.value, 0, () => {
      isShowAnimationLyrics.value = true
      nextTick(() => {
        PanelShowY(soloItem.value, 200, 0)
      })
    })
  } else {
    PanelHideY(soloItem.value, 200, () => {
      isShowAnimationLyrics.value = false
      PanelShowY(listPage.value, 0, 0)
    })
  }
}
// 点歌真正播起来后自动打开歌词页；已经在歌词页就不动
watch(
  () => lyricsOpenRequest.value,
  () => {
    if (isShowAnimationLyrics.value) return
    toggleLyricBoard()
  }
)

// 歌词页开着时若在音乐区内切页，先把它收起来——否则新页面会停在透明状态
const route = useRoute()
watch(
  () => route.fullPath,
  (to, from) => {
    if (!isShowAnimationLyrics.value) return
    // 进出音乐区不收，下次进来还是歌词页
    if (!to.startsWith('/music/') || !from.startsWith('/music/')) return
    PanelHideY(soloItem.value, 200, () => {
      isShowAnimationLyrics.value = false
      PanelShowY(listPage.value, 0, 0)
    })
  }
)

const musicCoverPath = computed(() => {
  return currentMusicInfo.value.cover || defaultCover
})

// 封面先预加载再替换，配合 Transition 做淡变，避免切歌时闪一下
const displayCover = ref(toThumb(musicCoverPath.value, 100))
let coverSeq = 0
watch(musicCoverPath, url => {
  if (!url || url === displayCover.value) return
  const seq = ++coverSeq
  const thumb = toThumb(url, 100)
  const preload = new Image()
  preload.onload = () => {
    if (seq === coverSeq) displayCover.value = thumb
  }
  preload.onerror = () => {
    if (seq === coverSeq) displayCover.value = defaultCover
  }
  preload.src = thumb
})
</script>

<template>
  <div
    class="flex box-border will-change-scroll absolute w-full h-full justify-center overflow-y-auto max-md:items-end"
  >
    <div
      class="box-border border bg-black/50 rounded-3xl relative m-auto duration-200 overflow-hidden w-[70%] h-[69%] flex max-md:my-0 max-md:rounded-t-3xl max-md:rounded-b-none max-md:w-full max-md:h-[90%] max-w-[1000px]"
    >
      <!-- 背景封面：scale-110 让模糊虚边落到裁剪线外，边上不露底色 -->
      <Transition name="bg-fade">
        <img
          :key="displayCover"
          class="absolute inset-0 w-full h-full object-cover object-center brightness-50 blur-md transform-gpu scale-110 will-change-[filter]"
          :src="displayCover"
          alt=""
        />
      </Transition>
      <div class="w-full h-full">
        <div
          v-show="!isShowAnimationLyrics"
          ref="listPage"
          class="absolute w-full h-[calc(100%_-_104px)] flex"
        >
          <div class="relative w-full h-full flex">
            <MusicLayout />
          </div>
        </div>
        <div
          v-if="isShowAnimationLyrics"
          ref="soloItem"
          class="box-border absolute w-full h-[calc(100%_-_104px)] z-10"
        >
          <!-- 切换按钮 -->
          <div
            class="absolute top-2 left-2 w-9 h-9 text-center z-10 text-white leading-8 hover:translate-y-2 duration-200"
            @click="toggleLyricBoard"
          >
            <i class="iconfont icon-xiangxiajiantou" />
          </div>
          <div
            class="absolute top-2 right-2 w-9 h-9 text-center z-10 text-white leading-8"
            @click="$router.push('/')"
          >
            <i class="iconfont icon-home" />
          </div>
          <soloPage></soloPage>
        </div>
        <div class="absolute w-full h-[104px] border-gradient text-[#000000] bottom-0 z-20">
          <div class="relative bottom-0 flex w-full h-full select-none">
            <controls :toggle-lyric-board="toggleLyricBoard" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.iconfont {
  @apply text-3xl cursor-pointer hover:text-[#0099FF] select-none duration-200;
}

.border-gradient {
  border-image: linear-gradient(to right, gray, white) 1;
}

/* 淡变压短，免得旧图拖着让人以为没切干净 */
.bg-fade-enter-active {
  transition: opacity 1s ease;
}

.bg-fade-leave-active {
  transition: opacity 1.5s ease;
}

.bg-fade-enter-from,
.bg-fade-leave-to {
  opacity: 0;
}
</style>
