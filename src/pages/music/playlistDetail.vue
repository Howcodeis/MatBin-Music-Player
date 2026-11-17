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
import { timeFormat, PLAYTYPE, formatCount, toHttps } from '@/utils/music'
import { useTableStyle, useLoadMore } from '@/composables/useTableStyle'
import { useIsMobile } from '@/composables/useResponsive'
import ArtistLinks from './components/artistLinks.vue'
import SongCell from './components/songCell.vue'
import defaultCover from '@/assets/image/109951173012411790.jpg'

defineOptions({
  name: 'PlaylistDetail'
})

const route = useRoute()
const router = useRouter()
const store = musicStatus()
const isMobile = useIsMobile()

const { playlistSongs, playlistInfo, playType } = storeToRefs(store)
const { headerCellStyle, headerRowStyle, rowStyle, cellStyle, rowClassName, markFavoriteClick, isJustFavorite } = useTableStyle()

const loading = ref(false)

const cover = computed(() => toHttps(playlistInfo.value.cover) || defaultCover)
const title = computed(() => String(route.query.name || playlistInfo.value.name || '歌单'))
const tags = computed(() => (Array.isArray(playlistInfo.value.tags) ? playlistInfo.value.tags : []))
const description = computed(() => playlistInfo.value.description || '')

// 歌单 id 变化（含首次进入）都重新拉元信息 + 第一页
watch(() => route.params.id, async (id) => {
  if (!id) return
  loading.value = true
  await store.setPlaylistDetail(id)
  loading.value = false
}, { immediate: true })

const { handleLoadMore } = useLoadMore(async () => {
  if (playlistSongs.value.length < store.searchSettings.playlistLimit) return
  await store.loadMorePlaylist()
})

const playChoose = (row) => {
  // 刚点过收藏就不算选中歌曲
  if (isJustFavorite()) return
  playType.value = PLAYTYPE.HOT
  store.setMusicInfo(row)
}

const isFavorite = id => store.isFavorite(id)
const toggleFavorite = row => {
  markFavoriteClick()
  store.toggleFavorite(row)
}

const goBack = () => {
  router.push({ name: 'hotPlayList' })
}

const albumOf = row => row.album?.name || row.al?.name || '-'
const durationOf = row => timeFormat((row.duration || row.dt) / 1000)
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
          <span v-if="playlistInfo.playCount" class="pl-num">播放 {{ formatCount(playlistInfo.playCount) }}</span>
        </div>
        <p v-if="description" class="pl-desc" :title="description">{{ description }}</p>
      </div>
      <button class="pl-back" type="button" title="返回热门歌单" aria-label="返回热门歌单" @click="goBack">
        <i class="iconfont icon-xiangzuo"></i>
      </button>
    </div>

    <!-- 歌曲列表 -->
    <div class="relative flex-1 min-h-0">
      <div v-if="!playlistSongs.length" class="pl-empty">
        {{ loading ? '歌单加载中…' : '该歌单暂无歌曲' }}
      </div>

      <el-table v-else :data="playlistSongs" row-key="id" v-el-table-infinite-scroll="handleLoadMore"
        :size="isMobile ? 'small' : 'default'"
        :style="{ width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0)' }" @row-click="playChoose"
        :header-cell-style="headerCellStyle" :header-row-style="headerRowStyle" :row-style="rowStyle"
        :cell-style="cellStyle" :row-class-name="rowClassName">
        <el-table-column fixed :width="isMobile ? 38 : 60" label="#">
          <template #default="scope">
            <div class="index-num text-gray-200 select-none">
              {{ (scope.$index + 1) < 10 ? "0" + (scope.$index + 1) : (scope.$index + 1) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column :width="isMobile ? 42 : 52" align="center">
          <template #default="scope">
            <i class="iconfont favorite-icon"
              :class="isFavorite(scope.row.id) ? 'icon-aixin1-copy is-favorite' : 'icon-aixin'"
              :title="isFavorite(scope.row.id) ? '取消喜欢' : '加入我喜欢的音乐'"
              @click.stop="toggleFavorite(scope.row)"></i>
          </template>
        </el-table-column>
        <el-table-column label="歌曲" :min-width="isMobile ? 140 : 110">
          <template #default="scope">
            <SongCell :song="scope.row" :cover-size="isMobile ? 30 : 38">
              <div class="song-name text-style" :title="scope.row.name">{{ scope.row.name }}</div>
              <div class="artist-names text-style">
                <ArtistLinks :artists="scope.row.ar || scope.row.artists" />
              </div>
            </SongCell>
          </template>
        </el-table-column>
        <el-table-column v-if="!isMobile" label="专辑" min-width="100">
          <template #default="scope">
            <div class="text-style text-[12px]" :title="albumOf(scope.row)">{{ albumOf(scope.row) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="时长" :width="isMobile ? 52 : undefined">
          <template #default="scope">
            <div class="duration">{{ durationOf(scope.row) }}</div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.text-style {
  @apply text-ellipsis overflow-hidden whitespace-nowrap
}

::v-deep(.el-table__body .el-table__row.hover-row td) {
  background-color: #777b83;
}

::v-deep(.el-table__inner-wrapper::before) {
  height: 0px;
}

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
  transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;
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
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

/* ---------------- 表格文字 ---------------- */
.song-name {
  font-size: 16px;
  color: #ffffff;
}

.artist-names {
  font-size: 10px;
  color: rgb(209, 213, 219);
}

.index-num {
  font-size: 16px;
}

.duration {
  font-size: 13px;
  color: rgb(209, 213, 219);
}

.favorite-icon {
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: color 0.2s ease, transform 0.2s ease;
}

/* 只在悬停设备上变色放大：触屏点完 :hover 会一直保持，
   把「已取消收藏」的状态色盖住，看起来像没反应 */
@media (hover: hover) and (pointer: fine) {
  .favorite-icon:hover {
    color: #ff6b81;
    transform: scale(1.15);
  }
}

.favorite-icon.is-favorite {
  color: #ff6b81;
}

@media (max-width: 639.98px) {
  .pl-name {
    font-size: 0.95rem;
  }

  .song-name {
    font-size: 14px;
    line-height: 1.35;
  }

  .artist-names {
    font-size: 11px;
    line-height: 1.3;
  }

  .index-num {
    font-size: 12px;
  }

  .duration {
    font-size: 12px;
  }

  ::v-deep(.el-table-fixed-column--left.is-last-column::before) {
    box-shadow: none;
  }
}
</style>
