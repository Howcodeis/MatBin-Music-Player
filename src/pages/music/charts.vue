<script setup>
/*
 * 音乐榜单：网易云官方榜（飙升 / 新歌 / 原创 / 热歌 / 荣耀热歌）
 *
 * 数据来自 /toplist/detail，一次请求拿到全部榜单和每个榜的前 3 首，
 * 点卡片进 playlistDetail 看完整歌曲列表。
 * 榜单本身就是一个歌单，所以详情页完全复用，不需要新建路由。
 */
import { defineOptions, onActivated, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { musicStatus } from '@/store'
import { formatCount, toThumb } from '@/utils/music'
import { saveScroll, takeScroll, clearScroll } from '@/composables/useScrollMemory'
import ListSkeleton from './components/listSkeleton.vue'
import defaultCover from '@/assets/image/109951173012411790.jpg'

defineOptions({
  name: 'Charts'
})

const router = useRouter()
const { topLists } = storeToRefs(musicStatus())
const loading = ref(true)

const SCROLL_KEY = 'charts'
const wrapRef = ref(null)
const getScroller = () => wrapRef.value

onBeforeRouteLeave(to => {
  if (to.name === 'playlistDetail') saveScroll(SCROLL_KEY, getScroller())
  else clearScroll(SCROLL_KEY)
})

// 卡片封面 96px，2x 屏取 200 够用
const coverOf = item => toThumb(item?.cover || '', 200) || defaultCover

const openChart = item => {
  if (!item?.id) return
  router.push({ name: 'playlistDetail', params: { id: item.id } })
}

let activatedOnce = false
onMounted(async () => {
  // 已有数据就不重复请求，返回时保留现场
  if (topLists.value.length) {
    loading.value = false
  } else {
    await musicStatus().setTopLists()
    loading.value = false
  }
})
onActivated(() => {
  if (!activatedOnce) {
    activatedOnce = true
    return
  }
  requestAnimationFrame(() => {
    const top = takeScroll(SCROLL_KEY)
    if (top && wrapRef.value) wrapRef.value.scrollTop = top
  })
})
</script>

<template>
  <div ref="wrapRef" class="charts-wrap">
    <header class="charts-head">
      <h1 class="charts-title">音乐榜单</h1>
      <p class="charts-sub">网易云官方榜，每天定时更新</p>
    </header>

    <ListSkeleton v-if="loading" :rows="6" />
    <div v-else-if="!topLists.length" class="charts-empty">
      <i class="iconfont icon-sousuo charts-empty__icon" />
      <p>暂时拿不到榜单，稍后再试</p>
    </div>

    <ul v-else class="charts-grid">
      <li v-for="item in topLists" :key="item.id" class="chart-card" @click="openChart(item)">
        <div class="chart-cover">
          <img :src="coverOf(item)" alt="" loading="lazy" referrerpolicy="no-referrer" />
        </div>

        <div class="chart-info">
          <p class="chart-name">{{ item.name }}</p>
          <p class="chart-meta">
            {{ item.updateFrequency }}
            <span v-if="item.playCount">· {{ formatCount(item.playCount) }}</span>
          </p>
          <ul class="chart-tracks">
            <li v-for="(track, index) in item.topTracks" :key="index" class="chart-track">
              <span class="chart-idx">{{ index + 1 }}</span>
              <span class="chart-track-name">{{ track.name }}</span>
              <span class="chart-track-artist">{{ track.artist }}</span>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.charts-wrap {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding: 0.85rem 1rem 1.5rem;
}

.charts-head {
  padding: 0 0.15rem 0.85rem;
}

.charts-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.04em;
}

.charts-sub {
  margin-top: 0.25rem;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.42);
}

/* ---------------- 榜单卡片 ---------------- */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

@media (max-width: 767.98px) {
  .charts-grid {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }
}

.chart-card {
  display: flex;
  gap: 0.75rem;
  padding: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

/* 触屏上 :hover 会粘住，只在真正支持悬停的设备上做位移 */
@media (hover: hover) and (pointer: fine) {
  .chart-card:hover {
    background: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.16);
    transform: translateY(-2px);
  }
}

.chart-card:active {
  background: rgba(255, 255, 255, 0.13);
  transform: scale(0.995);
}

.chart-cover {
  flex: none;
  width: 84px;
  height: 84px;
  border-radius: 0.55rem;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
}

.chart-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chart-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.chart-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.02em;
}

.chart-meta {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.42);
}

.chart-tracks {
  margin-top: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.chart-track {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-size: 0.7rem;
  line-height: 1.35;
  min-width: 0;
}

.chart-idx {
  flex: none;
  width: 0.8rem;
  color: rgba(255, 255, 255, 0.3);
  font-variant-numeric: tabular-nums;
}

.chart-track-name {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.82);
}

.chart-track-artist {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.36);
  font-size: 0.66rem;
}

/* ---------------- 空状态 ---------------- */
.charts-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 4rem 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.charts-empty__icon {
  font-size: 2.2rem;
  color: rgba(255, 255, 255, 0.26);
}
</style>
