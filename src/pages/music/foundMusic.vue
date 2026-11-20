<script setup>
/*
 * 发现音乐：每日推荐（/recommend/songs）
 *
 * 未登录也会返回一份日推，登录后是账号专属口味。
 * 这里直接以歌曲列表呈现：点行播放/收藏，播放类型记 DAILY，
 * 上下首就在当日推荐里轮转。
 */
import { computed, defineOptions, onActivated, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { musicStatus } from '@/store'
import { PLAYTYPE } from '@/utils/music'
import { useTableStyle } from '@/composables/useTableStyle'
import ListSkeleton from './components/listSkeleton.vue'
import VirtualSongList from './components/virtualSongList.vue'

defineOptions({
  name: 'FoundMusic'
})

const store = musicStatus()
const { dailySongs, currentMusicInfo } = storeToRefs(store)
const { markFavoriteClick, isJustFavorite } = useTableStyle()
// 区分还在加载和加载完但没数据，接口失败时不会一直显示加载中
const loading = ref(true)

// 今天的日期，放在标题下面当副标题
const today = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
})

const playChoose = row => {
  // 刚点过收藏就不算选中歌曲
  if (isJustFavorite()) return
  // 传当前列表当播放队列：之后再浏览别的歌单/重新搜索，不会替换正在播放的队列
  musicStatus().playFromList(dailySongs.value, row, PLAYTYPE.DAILY)
}

// 播放全部：从第一首开始，播放列表就是当日推荐
const playAll = () => {
  if (!dailySongs.value.length) return
  musicStatus().playFromList(dailySongs.value, dailySongs.value[0], PLAYTYPE.DAILY)
}

const toggleFavorite = row => {
  markFavoriteClick()
  store.toggleFavorite(row)
}

const refreshDaily = async () => {
  // 今天的已经拉过就直接用，跨天才重新请求
  if (!store.needRefreshDaily()) {
    loading.value = false
    return
  }
  await store.setDailySongs()
  loading.value = false
}

onMounted(refreshDaily)

// 页面被 KeepAlive 缓存后不会重新挂载，跨天再进来要靠 activated 补一次
let activatedOnce = false
onActivated(() => {
  if (!activatedOnce) {
    activatedOnce = true
    return
  }
  refreshDaily()
})
</script>

<template>
  <div class="box-border absolute h-full w-full flex flex-col">
    <!-- 每日推荐头部 -->
    <header class="daily-head shrink-0">
      <div class="daily-title-wrap">
        <h1 class="daily-title">每日推荐</h1>
        <p class="daily-sub">{{ today }} · 根据你的口味生成 · {{ dailySongs.length }} 首</p>
      </div>
      <button
        class="daily-play"
        type="button"
        :disabled="!dailySongs.length"
        title="从第一首开始播放"
        @click="playAll"
      >
        <i class="iconfont icon-bofang"></i>
        <span>播放全部</span>
      </button>
    </header>

    <!-- 歌曲列表 -->
    <div class="relative flex-1 min-h-0">
      <ListSkeleton v-if="loading" :rows="9" />
      <div v-else-if="!dailySongs.length" class="daily-empty">暂时获取不到每日推荐，请稍后再试</div>

      <VirtualSongList
        v-else
        :songs="dailySongs"
        :current-id="currentMusicInfo.id"
        @row-click="playChoose"
        @favorite-toggle="toggleFavorite"
      />
    </div>
  </div>
</template>

<style scoped>
/* ---------------- 头部 ---------------- */
.daily-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.75rem 0.9rem 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.daily-title {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #ffffff;
}

.daily-sub {
  margin-top: 0.15rem;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.55);
}

.daily-play {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.75rem;
  margin-right: 0.2rem;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-size: 0.75rem;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.daily-play:hover {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.4);
}

.daily-play:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.daily-play .iconfont {
  font-size: 0.85rem;
}

.daily-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}
</style>
