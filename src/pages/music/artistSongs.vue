<script setup>
import { computed, defineOptions, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { musicStatus } from '@/store'
import { timeFormat, PLAYTYPE } from '@/utils/music'
import { useTableStyle, useLoadMore } from '@/composables/useTableStyle'
import { useIsMobile } from '@/composables/useResponsive'
import { useArtistFilter } from '@/composables/useArtistFilter'
import ArtistLinks from './components/artistLinks.vue'
import SongCell from './components/songCell.vue'

defineOptions({
  name: 'ArtistSongs'
})

const route = useRoute()
const router = useRouter()
const store = musicStatus()
const isMobile = useIsMobile()

const { artistSongs, artistInfo, playType } = storeToRefs(store)
const { headerCellStyle, headerRowStyle, rowStyle, cellStyle, rowClassName, markFavoriteClick, isJustFavorite } = useTableStyle()
// 表格数据用筛选后的歌手热门，关键词来自顶部搜索框
const { keyword: artistKeyword, filteredArtistSongs, resetArtistKeyword } = useArtistFilter()

const artistName = computed(() => String(route.query.name || artistInfo.value.name || '歌手'))

/*
 * 返回用户点进来时所在的页面。
 * 来源页由 useGoArtist 写进 query.from；没有来源时退回浏览器上一页。
 */
const goBack = () => {
  const from = route.query.from
  // 只接受站内路径，避免被 URL 里的 from 带到站外
  if (typeof from === 'string' && from.startsWith('/')) {
    router.push(from)
    return
  }
  router.back()
}

// 歌手 id 变化都重新拉第一页
watch(() => route.params.id, (id) => {
  if (!id) return
  resetArtistKeyword()
  store.setArtistSongs({ id, name: String(route.query.name || '') })
}, { immediate: true })

// 触底加载：由 useLoadMore 保证同一时间只有一次请求
const { handleLoadMore } = useLoadMore(async () => {
  // 数据不满一页说明没有下一页
  if (artistSongs.value.length < store.searchSettings.artistLimit) return
  await store.loadMoreArtist()
})

// 点击行播放：切到歌手热门作为当前播放列表，上下首就在该歌手的热门里轮转
const playChoose = (row) => {
  // 刚点过收藏就不算选中歌曲
  if (isJustFavorite()) return
  playType.value = PLAYTYPE.ARTIST
  store.setMusicInfo(row)
}

// 收藏：爱心在序号右侧，点击只切换收藏，不触发播放
const isFavorite = id => store.isFavorite(id)
const toggleFavorite = row => {
  markFavoriteClick()
  store.toggleFavorite(row)
}

const albumOf = row => row.album?.name || row.al?.name || '-'
const durationOf = row => timeFormat((row.duration || row.dt) / 1000)
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
        <button class="artist-head__back" type="button" title="返回上一页" aria-label="返回上一页"
          @click="goBack">
          <i class="iconfont icon-xiangzuo"></i>
        </button>
      </div>
    </div>

    <div class="relative flex-1 min-h-0">
      <!-- 空状态：区分该歌手没歌和筛选不到 -->
      <div v-if="!artistSongs.length" class="artist-empty">
        <i class="iconfont icon-sousuo artist-empty__icon"></i>
        <p class="text-sm">该歌手暂无热门歌曲</p>
      </div>
      <div v-else-if="!filteredArtistSongs.length" class="artist-empty">
        <i class="iconfont icon-sousuo artist-empty__icon"></i>
        <p class="text-sm">没有找到「{{ artistKeyword }}」相关的歌曲</p>
        <p class="text-xs text-slate-400">换个歌名、歌手或专辑试试</p>
      </div>

      <el-table v-else :data="filteredArtistSongs" row-key="id" v-el-table-infinite-scroll="handleLoadMore"
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
        <!-- 爱心列：序号之后、歌名之前 -->
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
            <!-- 封面 + 歌名/歌手：封面在歌名左侧 -->
            <SongCell :song="scope.row" :cover-size="isMobile ? 30 : 38">
              <div class="song-name text-style" :title="scope.row.name">{{ scope.row.name }}</div>
              <!-- 歌手名可点：可以继续跳到合作歌手的热门页 -->
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

/* ---------------- 歌手信息头 ---------------- */
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
  transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.artist-head__back:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.18);
  transform: translateX(-2px);
}

.artist-head__back .iconfont {
  font-size: 0.95rem;
}

/* ---------------- 空状态 ---------------- */
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

/* ---------------- 表格文字 ---------------- */
.song-name {
  font-size: 16px;
  color: white;
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

/* 爱心：未收藏是描边，收藏后变实心红 */
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

/* 窄屏：整体降一档字号，一屏能多看几行 */
@media (max-width: 639.98px) {
  .artist-head__name {
    font-size: 0.95rem;
  }

  .artist-head__sub {
    font-size: 0.68rem;
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
