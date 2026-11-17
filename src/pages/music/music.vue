<script setup>
import { computed, defineOptions, inject, nextTick, provide, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import controls from './components/controls.vue';
import MusicLayout from './MusicLayout.vue';
import soloPage from './components/lyricBoard/soloPage.vue';
import { musicStatus } from '@/store';
import { storeToRefs } from 'pinia';
import { normalBack } from '@/utils/MessageBack';
import { PanelShowY, PanelHideY } from '@/utils/gsapTools'
import { toThumb } from '@/utils/music';
import defaultCover from '@/assets/image/109951173012411790.jpg';

defineOptions({
  name: 'MusicPage'
})

const { isShowAnimationLyrics, currentMusicInfo } = storeToRefs(musicStatus())

const closeMusic = inject('closeMusic', null)

/*
 * 回主页时先播完收起动画再放行导航。
 * 路由一变成 /，music 里的子路由就没匹配了，面板会先变空再动。
 */
onBeforeRouteLeave(async (to) => {
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
// 歌词面板调用函数
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
/*
 * 全屏歌词层打开时切换路由（例如点歌手名跳转）要先按原路收起：
 * 打开时 PanelHideY 已把 listPage 的 opacity 设为 0，若只把标志位改 false，
 * 新页面会留在透明状态看不见。
 *
 * 只在音乐区内部切页时才收；回主页不重置，这样下次进来还是歌词页。
 */
const route = useRoute()
watch(() => route.fullPath, (to, from) => {
  if (!isShowAnimationLyrics.value) return
  // 只有音乐区内部切页才收起；进出音乐区都保留歌词状态
  if (!to.startsWith('/music/') || !from.startsWith('/music/')) return
  PanelHideY(soloItem.value, 200, () => {
    isShowAnimationLyrics.value = false
    PanelShowY(listPage.value, 0, 0)
  })
})

// 封面路径
const musicCoverPath = computed(() => {
  return currentMusicInfo.value.cover || defaultCover
})

/*
 * 背景交叉淡变：
 * 先预加载新封面，等图片解码完再替换 displayCover，配合Transition做透明度过渡，
 */
const displayCover = ref(toThumb(musicCoverPath.value, 100))
let coverSeq = 0
watch(musicCoverPath, (url) => {
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
  <!-- 整个音乐界面 包括空白 -->
  <div
    class="flex box-border will-change-scroll absolute w-full h-full min-h-[40rem] justify-center items-center max-md:min-h-0 max-md:items-end">
    <!-- 音乐展示界面 不包括空白-->
    <div
      class="box-border border bg-black/50 rounded-3xl absolute min-h-[660px] duration-200 overflow-hidden w-[70%] h-2/3 flex max-md:min-h-0 max-md:rounded-t-3xl max-md:rounded-b-none max-md:w-full max-md:h-[80%] max-w-[1000px]">
      <!--背景封面：切歌时新旧两张图交叉淡变。scale-105 让 blur 的虚边落到裁剪线外，不会在边上露底色。-->
      <Transition name="bg-fade">
        <img :key="displayCover"
          class="absolute inset-0 w-full h-full object-cover object-center brightness-50 blur-md transform-gpu scale-105"
          :src="displayCover" alt="">
      </Transition>
      <!-- 列表和控件页面 -->
      <div class="w-full h-full">
        <!--列表展示以及侧栏部分-->
        <div ref="listPage" v-show="!isShowAnimationLyrics"
          class=" absolute w-full h-[85%] max-md:h-[calc(100%_-_104px)] flex">
          <!-- 音乐列表以及搜索 -->
          <div class="relative w-full h-full flex">
            <MusicLayout />
          </div>
        </div>
        <!-- 主奏页面 -->
        <div ref="soloItem" v-if="isShowAnimationLyrics"
          class="box-border absolute w-full h-[85%] max-md:h-[calc(100%_-_104px)] z-10">
          <!-- 切换按钮 -->
          <div @click="toggleLyricBoard"
            class='absolute top-2 left-2 w-9 h-9 text-center z-10 text-white leading-8 hover:translate-y-2 duration-200'>
            <i class="iconfont icon-xiangxiajiantou" />
          </div>
          <div @click="$router.push('/')" class="absolute top-2 right-2 w-9 h-9 text-center z-10 text-white leading-8">
            <i class="iconfont icon-home" />
          </div>
          <soloPage></soloPage>
        </div>
        <!--控件部分-->
        <div class="absolute w-full h-[15%] max-md:h-[104px] border-gradient text-[#000000] bottom-0 z-20">
          <!-- 控键 -->
          <div class="relative bottom-0 flex w-full h-full select-none ">
            <controls :toggleLyricBoard="toggleLyricBoard" />
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

.border-gradient-t-b {
  border-image: linear-gradient(to bottom, gray, white) 1;
}

/*
 * 切歌背景交叉淡变。
 * 两张图同时存在时是叠加状态，旧图拖太久会让人以为背景没切干净，所以两边都压短。
 */
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
