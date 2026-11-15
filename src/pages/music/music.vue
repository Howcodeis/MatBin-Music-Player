<script setup>
import { computed, defineOptions, nextTick, provide, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import controls from './components/controls.vue';
import MusicLayout from './MusicLayout.vue';
import soloPage from './components/lyricBoard/soloPage.vue';
import { musicStatus } from '@/store';
import { storeToRefs } from 'pinia';
import { normalBack } from '@/utils/MessageBack';
import { PanelShowY, PanelHideY } from '@/utils/gsapTools'
import defaultCover from '@/assets/image/109951173012411790.jpg';

defineOptions({
  name: 'MusicPage'
})

const { isShowAnimationLyrics, currentMusicInfo } = storeToRefs(musicStatus())

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
 * 新页面会留在透明状态看不见，所以必须走 PanelHideY → PanelShowY 这条动画链。
 */
const route = useRoute()
watch(() => route.fullPath, () => {
  if (!isShowAnimationLyrics.value) return
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
 * 先预加载新封面，等图片真正解码完再替换 displayCover，
 * 配合模板里的 <Transition> 做透明度过渡。这样淡入过程中不会出现空白/闪白。
 * coverSeq 用于快速连续切歌时丢弃过期的预加载结果。
 */
const displayCover = ref(musicCoverPath.value)
let coverSeq = 0
watch(musicCoverPath, (url) => {
  if (!url || url === displayCover.value) return
  const seq = ++coverSeq
  const preload = new Image()
  preload.onload = () => {
    if (seq === coverSeq) displayCover.value = url
  }
  preload.onerror = () => {
    if (seq === coverSeq) displayCover.value = defaultCover
  }
  preload.src = url
})


</script>

<template>
  <!-- 整个音乐界面 包括空白 -->
  <div
    class="flex box-border will-change-scroll absolute w-full h-full min-h-[40rem] justify-center items-center max-md:min-h-0 max-md:items-end">
    <!-- 音乐展示界面 不包括空白-->
    <div
      class="box-border border rounded-3xl absolute min-h-[660px] duration-200 overflow-hidden w-[70%] h-2/3 flex max-md:min-h-0 max-md:rounded-t-3xl max-md:rounded-b-none max-md:w-full max-md:h-[80%] max-w-[1000px] bg-black/50">
      <!-- 背景封面：切歌时新旧两张图交叉淡变 -->
      <Transition name="bg-fade">
        <img :key="displayCover" class="absolute w-full h-full scale-[1.5] brightness-50 blur-md" :src="displayCover"
          alt="">
      </Transition>
      <!-- 列表和控件页面 -->
      <div class="w-full h-full">
        <!--列表展示以及侧栏部分-->
        <div ref="listPage" v-show="!isShowAnimationLyrics" class=" absolute w-full h-[85%] flex">
          <!-- 音乐列表以及搜索 -->
          <div class="relative w-full h-full flex">
            <MusicLayout />
          </div>
        </div>
        <!-- 主奏页面 -->
        <div ref="soloItem" v-if="isShowAnimationLyrics" class="box-border absolute w-full h-[85%] z-10">
          <!-- 切换按钮 -->
          <div @click="toggleLyricBoard"
            class='absolute top-2 left-2 w-9 h-9 text-center z-10 text-[#99CCFF] leading-8 hover:translate-y-2 duration-200'>
            <i class="iconfont icon-xiangxiajiantou" />
          </div>
          <div @click="$router.push('/')"
            class="absolute top-2 right-2 w-9 h-9 text-center z-10 text-[#99CCFF] leading-8 hover:translate-y-2 duration-200">
            <i class="iconfont icon-home" />
          </div>
          <soloPage></soloPage>
        </div>
        <!--控件部分-->
        <div class="absolute w-full h-[15%] border-gradient text-[#000000] bottom-0 z-20">
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
  @apply text-3xl cursor-pointer hover:text-[#0099FF] select-none
}

.border-gradient {
  border-image: linear-gradient(to right, gray, white) 1;
}

.border-gradient-t-b {
  border-image: linear-gradient(to bottom, gray, white) 1;
}

/*
 * 切歌背景交叉淡变。
 * 新图淡入 0.7s、旧图淡出 1.1s：旧图更慢地退场，垫在下面，
 * 两张同时半透明时也不会透出底色。
 */
.bg-fade-enter-active {
  transition: opacity 0.7s ease;
}

.bg-fade-leave-active {
  transition: opacity 1.1s ease;
}

.bg-fade-enter-from,
.bg-fade-leave-to {
  opacity: 0;
}
</style>
