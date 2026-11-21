<script setup>
import { computed, defineOptions, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { musicStatus } from '@/store'
import { PLAYTYPE } from '@/utils/music'
import { useTableStyle, useLoadMore } from '@/composables/useTableStyle'
import { useArtistFilter } from '@/composables/useArtistFilter'
import ListSkeleton from './components/listSkeleton.vue'
import VirtualSongList from './components/virtualSongList.vue'

defineOptions({
  name: 'ArtistSongs'
})

const route = useRoute()
const router = useRouter()
const store = musicStatus()

const { artistSongs, artistInfo, currentMusicInfo } = storeToRefs(store)
const { markFavoriteClick, isJustFavorite } = useTableStyle()
// 表格数据用筛选后的歌手热门，关键词来自顶部搜索框
const { keyword: artistKeyword, filteredArtistSongs, resetArtistKeyword } = useArtistFilter()

const artistName = computed(() => String(route.query.name || artistInfo.value.name || '歌手'))

// 用 back 弹出当前页，别用 push(from)——会多压一条来源页，返回时又弹回歌手页死循环。
// 直接输 URL 没历史时，才用 from 兜底（replace 不压栈）
const goBack = () => {
  const back = router.options.history.state.back
  if (typeof back === 'string' && back.startsWith('/')) {
    router.back()
    return
  }
  const from = route.query.from
  if (typeof from === 'string' && from.startsWith('/')) {
    router.replace(from)
    return
  }
  router.back()
}

// 数据没回来之前显示骨架屏，避免误显示成「暂无歌曲」
const loading = ref(true)

// 触底加载要在 watch 之前声明：下面的 watch 带 immediate，setup 阶段就会执行
const { isLoadingMore, handleLoadMore, resetLoadMore } = useLoadMore(async () => {
  // 到底与否由 store 按接口 more 字段判断，不看本页条数
  if (store.searchSettings.isArtistOverCounts) return null
  const before = artistSongs.value.length
  await store.loadMoreArtist()
  return {
    added: artistSongs.value.length - before,
    hasMore: !store.searchSettings.isArtistOverCounts
  }
})

// 歌手 id 变化都重新拉第一页
watch(
  () => route.params.id,
  async id => {
    if (!id) return
    resetArtistKeyword()
    resetLoadMore()
    loading.value = true
    await store.setArtistSongs({ id, name: String(route.query.name || '') })
    loading.value = false
  },
  { immediate: true }
)

// 点击行播放：切到歌手热门作为当前播放列表，上下首就在该歌手的热门里轮转
const playChoose = row => {
  // 刚点过收藏就不算选中歌曲
  if (isJustFavorite()) return
  // 传当前列表当播放队列：之后再浏览别的歌单/重新搜索，不会替换正在播放的队列
  musicStatus().playFromList(filteredArtistSongs.value, row, PLAYTYPE.ARTIST, artistInfo.value.id)
}

// 收藏：爱心在序号右侧，点击只切换收藏，不触发播放
const toggleFavorite = row => {
  markFavoriteClick()
  store.toggleFavorite(row)
}

const hasMore = computed(() => !store.searchSettings.isArtistOverCounts)
</script>

<template>
  <div class="box-border absolute h-full w-full flex flex-col">
    <!-- 歌手信息头：名字 + 歌曲数 -->
    <div class="artist-head shrink-0">
      <div class="artist-head__name" :title="artistName">{{ artistName }}</div>
      <!-- 第二行：左边是歌曲信息，右边靠边放返回按钮 -->
      <div class="artist-head__row">
        <div class="artist-head__sub">
          <span>热门歌曲</span>
          <i class="artist-head__dot">·</i>
          <span>{{ artistSongs.length }} 首</span>
          <span v-if="artistKeyword" class="artist-head__filter">
            （筛选出 {{ filteredArtistSongs.length }} 首）
          </span>
        </div>
        <button
          class="artist-head__back"
          type="button"
          title="返回上一页"
          aria-label="返回上一页"
          @click="goBack"
        >
          <i class="iconfont icon-xiangzuo"></i>
        </button>
      </div>
    </div>

    <div class="relative flex-1 min-h-0">
      <!-- 空状态：区分加载中、该歌手没歌和筛选不到 -->
      <ListSkeleton v-if="loading" :rows="8" />
      <div v-else-if="!artistSongs.length" class="artist-empty">
        <i class="iconfont icon-sousuo artist-empty__icon"></i>
        <p class="text-sm">该歌手暂无热门歌曲</p>
      </div>
      <div v-else-if="!filteredArtistSongs.length" class="artist-empty">
        <i class="iconfont icon-sousuo artist-empty__icon"></i>
        <p class="text-sm">没有找到「{{ artistKeyword }}」相关的歌曲</p>
        <p class="text-xs text-slate-400">换个歌名、歌手或专辑试试</p>
      </div>

      <VirtualSongList
        v-else
        :songs="filteredArtistSongs"
        :current-id="currentMusicInfo.id"
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
/* 歌手信息头 */
.artist-head {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.35rem 0.6rem 0.45rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
}

.artist-head__name {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 第二行：歌曲信息在左，返回按钮贴在右边缘 */
.artist-head__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.artist-head__sub {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  color: rgba(209, 213, 219, 0.85);
}

.artist-head__dot {
  font-style: normal;
  opacity: 0.6;
}

.artist-head__filter {
  color: #99ccff;
}

/* 返回按钮：靠右贴边，hover 时轻微左移，暗示“返回” */
.artist-head__back {
  flex: 0 0 auto;
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

.artist-head__back:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.18);
  transform: translateX(-2px);
}

.artist-head__back .iconfont {
  font-size: 0.95rem;
}

/* 空状态 */
.artist-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
  height: 100%;
  color: rgb(203, 213, 225);
}

.artist-empty__icon {
  font-size: 2.4rem;
  color: rgba(255, 255, 255, 0.28);
}

/* 窄屏：整体降一档字号，一屏能多看几行 */
@media (max-width: 639.98px) {
  .artist-head__name {
    font-size: 0.95rem;
  }

  .artist-head__sub {
    font-size: 0.68rem;
  }
}
</style>
