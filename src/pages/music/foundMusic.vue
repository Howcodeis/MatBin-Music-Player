<script setup>
/*
 * 发现音乐：每日推荐（/recommend/songs）
 *
 * 未登录也会返回一份日推，登录后是账号专属口味。
 * 这里直接以歌曲列表呈现：点行播放/收藏，播放类型记 DAILY，
 * 上下首就在当日推荐里轮转。
 */
import { computed, defineOptions, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { musicStatus } from '@/store'
import { timeFormat, PLAYTYPE } from '@/utils/music'
import { useTableStyle } from '@/composables/useTableStyle'
import { useIsMobile } from '@/composables/useResponsive'
import ArtistLinks from './components/artistLinks.vue'
import SongCell from './components/songCell.vue'

defineOptions({
  name: 'FoundMusic'
})

const store = musicStatus()
const isMobile = useIsMobile()
const { dailySongs, playType } = storeToRefs(store)
const { headerCellStyle, headerRowStyle, rowStyle, cellStyle } = useTableStyle()
// 区分「还在加载」和「加载完但没数据」，接口失败时不会一直显示加载中
const loading = ref(true)

// 今天的日期，放在标题下面当副标题
const today = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
})

const playChoose = (row) => {
  playType.value = PLAYTYPE.DAILY
  store.setMusicInfo(row)
}

// 播放全部：从第一首开始，播放列表就是当日推荐
const playAll = () => {
  if (!dailySongs.value.length) return
  playType.value = PLAYTYPE.DAILY
  store.setMusicInfo(dailySongs.value[0])
}

const isFavorite = id => store.isFavorite(id)
const toggleFavorite = row => store.toggleFavorite(row)

const albumOf = row => row.album?.name || row.al?.name || '-'
const durationOf = row => timeFormat((row.duration || row.dt) / 1000)

onMounted(async () => {
  // 已有数据就不重复请求
  if (dailySongs.value.length) {
    loading.value = false
    return
  }
  await store.setDailySongs()
  loading.value = false
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
      <button class="daily-play" type="button" :disabled="!dailySongs.length" title="从第一首开始播放"
        @click="playAll">
        <i class="iconfont icon-bofang"></i>
        <span>播放全部</span>
      </button>
    </header>

    <!-- 歌曲列表 -->
    <div class="relative flex-1 min-h-0">
      <div v-if="loading" class="daily-empty">正在获取每日推荐…</div>
      <div v-else-if="!dailySongs.length" class="daily-empty">暂时获取不到每日推荐，请稍后再试</div>

      <el-table v-else :data="dailySongs" row-key="id" :size="isMobile ? 'small' : 'default'"
        :style="{ width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0)' }" @row-click="playChoose"
        :header-cell-style="headerCellStyle" :header-row-style="headerRowStyle" :row-style="rowStyle"
        :cell-style="cellStyle">
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
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
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

.favorite-icon:hover {
  color: #ff6b81;
  transform: scale(1.15);
}

.favorite-icon.is-favorite {
  color: #ff6b81;
}

@media (max-width: 639.98px) {
  .daily-title {
    font-size: 1.1rem;
  }

  .daily-sub {
    font-size: 0.65rem;
  }

  .daily-play {
    padding: 0.25rem 0.6rem;
    font-size: 0.7rem;
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
