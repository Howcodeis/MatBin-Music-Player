<script setup>
import { defineOptions, onMounted } from 'vue';
import { musicStatus } from './store';
import defaultCover from '@/assets/image/109951173012411790.jpg';
import { animateToHidden, animateToVisible } from './utils/gsapTools';

defineOptions({
  name: 'App'
})

const store = musicStatus()

onMounted(() => {
  store.initAudio()
})

// 记录每个元素上正在跑的补间，打断时能强制收尾
const tweens = new WeakMap()

/**
 * 结束元素上残留的补间
 * 直接 kill 不会触发 onComplete，Vue 等不到 done 会卡住过渡，
 * 所以这里用 progress(1) 让它跑到终点，把上一个 done 正常兑现。
 */
const finishPrevTween = (el) => {
  const prev = tweens.get(el)
  if (prev && prev.isActive()) prev.progress(1)
}

const onPageEnter = (el, done) => {
  finishPrevTween(el)
  const tween = animateToVisible(el, 0.5, 0.92, done)
  tweens.set(el, tween)
}

const onPageLeave = (el, done) => {
  finishPrevTween(el)
  const tween = animateToHidden(el, 0.5, 0, done)
  tweens.set(el, tween)
}
</script>

<template>
  <!-- 整站背景固定用本地默认图，不再跟随当前歌曲封面（随歌封面只在 music.vue 内部展示） -->
  <div class="w-full body flex items-center justify-center" :style="{ backgroundImage: 'url(' + defaultCover + ')' }">
  <router-view v-slot="{ Component }">
      <Transition :css="false" @enter="onPageEnter" @leave="onPageLeave">
        <component :is="Component" />
      </Transition>
    </router-view>
  </div>
</template>

<style scoped>
.body {
  height: 100vh;
  background-size: cover;
  background-position: center;
  position: relative;
}

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
