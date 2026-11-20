<script setup>
/*
 * 歌单详情：热门歌单卡片点进来的落地页
 *
 * 头部展示歌单元信息（封面/名称/作者/标签/歌曲数/播放量/简介），
 * 下面是歌曲表格，30 首一页、触底加载；点在播后 playType=HOT，
 * 上下首就在这个歌单里轮转。
 */
import { computed, defineOptions, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { musicStatus } from '@/store'
import { PLAYTYPE, formatCount, toHttps } from '@/utils/music'
import { useTableStyle, useLoadMore } from '@/composables/useTableStyle'
import { usePlayListDetailsFilter } from '@/composables/usePlayListDetailsFilter'
import ListSkeleton from './components/listSkeleton.vue'
import VirtualSongList from './components/virtualSongList.vue'
import defaultCover from '@/assets/image/109951173012411790.jpg'

defineOptions({
  name: 'PlaylistDetail'
})

const route = useRoute()
const router = useRouter()
const store = musicStatus()

const { playlistSongs, playlistInfo, currentMusicInfo } = storeToRefs(store)
const { markFavoriteClick, isJustFavorite } = useTableStyle()
// 关键词由顶部搜索栏写入（searchBar 里已经接好了），这里只消费过滤结果
const { keyword: playlistKeyword, filteredPlayListDetails } = usePlayListDetailsFilter()

const loading = ref(false)

// 歌单滚动位置记忆：key 按歌单 id 隔离，切到别的歌单不会串位置。
// 前缀避免和 charts / hotPlayList 的 key 撞上。
const songList = ref(null)
const scrollKey = computed(() => `playlist-detail:${String(route.params.id || '')}`)

const cover = computed(() => toHttps(playlistInfo.value.cover) || defaultCover)
const title = computed(() => String(route.query.name || playlistInfo.value.name || '歌单'))
const tags = computed(() => (Array.isArray(playlistInfo.value.tags) ? playlistInfo.value.tags : []))
const description = computed(() => playlistInfo.value.description || '')

// 触底加载要在 watch 之前声明：下面的 watch 带 immediate，setup 阶段就会执行
const { isLoadingMore, handleLoadMore, resetLoadMore } = useLoadMore(async () => {
  // 到底与否由 store 按歌单 trackCount 判断，不看本页条数
  if (store.searchSettings.isPlaylistOverCounts) return null
  const before = playlistSongs.value.length
  await store.loadMorePlaylist()
  return {
    added: playlistSongs.value.length - before,
    hasMore: !store.searchSettings.isPlaylistOverCounts
  }
})

// 歌单 id 变化（含首次进入）都重新拉元信息 + 第一页
watch(
  () => route.params.id,
  async id => {
    if (!id) return
    // 换歌单时清掉上一个歌单的关键词，否则新歌单会莫名其妙只剩几条
    playlistKeyword.value = ''
    resetLoadMore()
    loading.value = true
    await store.setPlaylistDetail(id)
    loading.value = false
  },
  { immediate: true }
)

const playChoose = row => {
  // 刚点过收藏就不算选中歌曲
  if (isJustFavorite()) return
  // 点歌这一刻记下滚动距离，下次进同一歌单仍停在这里
  songList.value?.saveCurrentScroll()
  // 传当前列表当播放队列：之后再浏览别的歌单/重新搜索，不会替换正在播放的队列
  musicStatus().playFromList(
    filteredPlayListDetails.value,
    row,
    PLAYTYPE.HOT,
    playlistInfo.value.id
  )
}

const toggleFavorite = row => {
  markFavoriteClick()
  store.toggleFavorite(row)
}

const hasMore = computed(() => !store.searchSettings.isPlaylistOverCounts)

/*
 * 返回上一页，而不是固定回热门歌单。
 * 详情页现在有三个入口：热门歌单卡片、音乐榜单卡片、外部链接，
 * 写死目标会把从榜单进来的用户莫名送回热门歌单。
 * 直接输 URL 进来时没有历史记录，兜底回热门歌单。
 */
const goBack = () => {
  const back = router.options.history.state.back
  // 只认应用内的历史（以 / 开头）；从外部链接或新标签直接进来时 back 可能是空或外站地址
  if (typeof back === 'string' && back.startsWith('/')) router.back()
  else router.push({ name: 'hotPlayList' })
}
</script>

<template>
  <div class="box-border absolute h-full w-full flex flex-col">
    <!-- 歌单头部 -->
    <div class="pl-head shrink-0">
      <img class="pl-cover" :src="cover" alt="" loading="lazy" referrerpolicy="no-referrer" />
      <div class="pl-meta">
        <h1 class="pl-name" :title="title">{{ title }}</h1>
        <div class="pl-sub">
          <span v-if="playlistInfo.creator" class="pl-creator">by {{ playlistInfo.creator }}</span>
          <span v-if="tags.length" class="pl-tags">
            <span v-for="tag in tags.slice(0, 3)" :key="tag" class="pl-tag">{{ tag }}</span>
          </span>
          <span class="pl-num">{{ playlistInfo.trackCount || playlistSongs.length }} 首</span>
          <span v-if="playlistInfo.playCount" class="pl-num">
            播放 {{ formatCount(playlistInfo.playCount) }}
          </span>
        </div>
        <p v-if="description" class="pl-desc" :title="description">{{ description }}</p>
      </div>
      <button
        class="pl-back"
        type="button"
        title="返回上一页"
        aria-label="返回上一页"
        @click="goBack"
      >
        <i class="iconfont icon-xiangzuo"></i>
      </button>
    </div>

    <!-- 歌曲列表 -->
    <div class="relative flex-1 min-h-0">
      <ListSkeleton v-if="loading" :rows="8" />
      <div v-else-if="!playlistSongs.length" class="pl-empty">该歌单暂无歌曲</div>
      <!-- 搜到了但没匹配：和「歌单本身没歌」区分开 -->
      <div v-else-if="!filteredPlayListDetails.length" class="pl-empty">
        <i class="iconfont icon-sousuo pl-empty__icon" />
        <p>没有找到「{{ playlistKeyword }}」相关的歌曲</p>
        <p class="pl-empty__tip">换个歌名、歌手或专辑试试</p>
      </div>

      <VirtualSongList
        v-else
        ref="songList"
        :songs="filteredPlayListDetails"
        :current-id="currentMusicInfo.id"
        :scroll-memory-key="scrollKey"
        :loading="isLoadingMore"
        :has-more="hasMore"
        @row-click="playChoose"
        @favorite-toggle="toggleFavorite"
        @load-more="handleLoadMore"
      />
    </div>
  </div>
</template>

<style scoped>
/* ---------------- 歌单头部 ---------------- */
.pl-head {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  padding: 0.75rem 0.9rem 0.7rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.pl-cover {
  flex: 0 0 auto;
  width: 72px;
  height: 72px;
  border-radius: 0.6rem;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
}

@media (min-width: 640px) {
  .pl-cover {
    width: 92px;
    height: 92px;
  }
}

.pl-meta {
  flex: 1;
  min-width: 0;
  /* 给右上角返回按钮留出位置 */
  padding-right: 2.2rem;
}

.pl-name {
  overflow: hidden;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.3;
  color: #ffffff;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pl-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.25rem;
  font-size: 0.7rem;
  color: rgba(209, 213, 219, 0.85);
}

.pl-creator {
  color: #99ccff;
}

.pl-tags {
  display: inline-flex;
  gap: 0.25rem;
}

.pl-tag {
  padding: 0 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  font-size: 0.62rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.75);
}

.pl-num {
  font-variant-numeric: tabular-nums;
}

.pl-desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 0.25rem;
  font-size: 0.66rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}

/* 返回按钮：贴右上角 */
.pl-back {
  position: absolute;
  top: 0.55rem;
  right: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.7rem;
  height: 1.7rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.82);
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.pl-back:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.18);
  transform: translateX(-2px);
}

.pl-back .iconfont {
  font-size: 0.95rem;
}

.pl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  width: 100%;
  height: 100%;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.pl-empty__icon {
  font-size: 2.4rem;
  color: rgba(255, 255, 255, 0.28);
  margin-bottom: 0.2rem;
}

.pl-empty__tip {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.32);
}

/* ---------------- 表格文字 ---------------- */
/* 只在悬停设备上变色放大：触屏点完 :hover 会一直保持，
   把「已取消收藏」的状态色盖住，看起来像没反应 */

@media (max-width: 639.98px) {
  .pl-name {
    font-size: 0.95rem;
  }
}
</style>
