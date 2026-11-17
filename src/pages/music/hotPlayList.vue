<script setup>
/*
 * 热门歌单：网易云「推荐歌单」（/personalized）
 *
 * 这里只负责歌单卡片墙，点卡片进 playlistDetail 看歌曲。
 * 接口免登录，卡片数据带 playCount / trackCount / copywriter，足够做信息层级。
 */
import { defineOptions, nextTick, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { musicStatus } from '@/store'
import { formatCount, toHttps } from '@/utils/music'
import { saveScroll, takeScroll, clearScroll } from '@/composables/useScrollMemory'
import defaultCover from '@/assets/image/109951173012411790.jpg'

defineOptions({
  name: 'HotPlayList'
})

const router = useRouter()
const { recommendedPlayLists } = storeToRefs(musicStatus())
// 区分还在加载和加载完但没数据，否则接口失败会一直停在骨架屏
const loading = ref(true)

// 卡片墙的滚动发生在 MusicLayout 的外层容器上，这里向上找到它
const SCROLL_KEY = 'hotPlayList'
const wrapRef = ref(null)
const getScroller = () => {
  let el = wrapRef.value?.parentElement
  while (el) {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return el
    el = el.parentElement
  }
  return null
}

/*
 * 进歌单详情前记住列表滚动位置，返回时恢复；
 * 去别的模块则清掉，避免下次从侧栏进来停在上次的一半位置。
 */
onBeforeRouteLeave((to) => {
  if (to.name === 'playlistDetail') saveScroll(SCROLL_KEY, getScroller())
  else clearScroll(SCROLL_KEY)
})

const coverOf = item => toHttps(item?.picUrl) || defaultCover

const openPlaylist = (item) => {
  router.push({
    name: 'playlistDetail',
    params: { id: String(item.id) },
    // 名字放 query 让详情页首屏立刻有标题，真正的元信息仍以接口为准
    query: item.name ? { name: item.name } : {}
  })
}

onMounted(async () => {
  // 已有数据就不重复请求，返回页面时保留现场
  if (recommendedPlayLists.value.length) {
    loading.value = false
  } else {
    await musicStatus().setRecommendedPlayLists()
    loading.value = false
  }

  // 等卡片渲染完、高度稳定后再恢复滚动位置
  const top = takeScroll(SCROLL_KEY)
  if (top <= 0) return
  await nextTick()
  requestAnimationFrame(() => {
    const scroller = getScroller()
    if (scroller) scroller.scrollTop = top
  })
})
</script>

<template>
  <div ref="wrapRef" class="hot-wrap">
    <header class="hot-head">
      <div>
        <h1 class="hot-title">热门歌单</h1>
        <p class="hot-sub">为你精选 · 共 {{ recommendedPlayLists.length }} 个歌单</p>
      </div>
    </header>

    <!-- 加载骨架：避免一进来是空白 -->
    <div v-if="loading" class="hot-grid">
      <div v-for="n in 10" :key="n" class="hot-card is-skeleton">
        <div class="hot-cover skeleton"></div>
        <div class="hot-info">
          <div class="sk-line w-3/4"></div>
          <div class="sk-line w-1/2"></div>
        </div>
      </div>
    </div>

    <!-- 接口失败/无数据：给个明确状态，不要一直卡在骨架屏 -->
    <div v-else-if="!recommendedPlayLists.length" class="hot-empty">暂时没有推荐歌单，请稍后再试</div>

    <div v-else class="hot-grid">
      <article v-for="item in recommendedPlayLists" :key="item.id" class="hot-card" @click="openPlaylist(item)">
        <div class="hot-cover">
          <img :src="coverOf(item)" alt="" loading="lazy" referrerpolicy="no-referrer" />
          <!-- 播放量角标 -->
          <span class="hot-count" :title="`${item.playCount} 次播放`">
            <i class="iconfont icon-bofang"></i>{{ formatCount(item.playCount) }}
          </span>
          <!-- hover 浮现的播放按钮 -->
          <span class="hot-play" aria-hidden="true">
            <i class="iconfont icon-bofang"></i>
          </span>
        </div>
        <div class="hot-info">
          <h3 class="hot-name" :title="item.name">{{ item.name }}</h3>
          <p class="hot-desc" :title="item.copywriter">{{ item.copywriter || '推荐歌单' }}</p>
          <p class="hot-meta">{{ item.trackCount }} 首</p>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.hot-wrap {
  padding: 0.75rem 0.9rem 1.2rem;
}

.hot-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 0.8rem;
}

.hot-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.02em;
}

.hot-sub {
  margin-top: 0.15rem;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.55);
}

/* 响应式卡片墙：窄屏 2 列，逐步加到 5 列 */
.hot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 0.75rem;
}

@media (min-width: 640px) {
  .hot-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .hot-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .hot-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

.hot-card {
  min-width: 0;
  cursor: pointer;
}

.hot-cover {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
}

.hot-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s ease;
}

.hot-card:hover .hot-cover img {
  transform: scale(1.06);
}

.hot-count {
  position: absolute;
  top: 0.4rem;
  right: 0.45rem;
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.1rem 0.38rem;
  border-radius: 9999px;
  /* 用不透明度更高的纯色代替 backdrop-filter：卡片一多，每张都在实时采样背后像素，滚动会明显掉帧 */
  background: rgba(0, 0, 0, 0.62);
  color: #ffffff;
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
}

.hot-count .iconfont {
  font-size: 0.62rem;
}

/* hover 才出现的播放按钮，避免静态时太吵 */
.hot-play {
  position: absolute;
  right: 0.5rem;
  bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.92);
  color: #1f2937;
  opacity: 0;
  transform: translateY(4px) scale(0.9);
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.hot-card:hover .hot-play {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.hot-info {
  padding: 0.4rem 0.1rem 0;
}

.hot-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
  color: #ffffff;
}

.hot-desc {
  margin-top: 0.15rem;
  overflow: hidden;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.hot-meta {
  margin-top: 0.1rem;
  font-size: 0.66rem;
  color: rgba(255, 255, 255, 0.4);
}

.hot-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

/* ---------------- 骨架屏 ---------------- */
.hot-card.is-skeleton {
  pointer-events: none;
}

.skeleton,
.sk-line {
  background: rgba(255, 255, 255, 0.09);
  animation: hot-pulse 1.4s ease-in-out infinite;
}

.hot-cover.skeleton {
  animation: hot-pulse 1.4s ease-in-out infinite;
}

.sk-line {
  height: 0.55rem;
  margin-top: 0.45rem;
  border-radius: 9999px;
}

@keyframes hot-pulse {

  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}
</style>
