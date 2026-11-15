<script setup>
import { defineOptions, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { musicStatus } from '@/store';
import { timeFormat, PLAYTYPE } from '@/utils/music';
import { useTableStyle, formatArtists } from '@/composables/useTableStyle';
import { useIsMobile } from '@/composables/useResponsive';
import { useFavoriteFilter } from '@/composables/useFavoriteFilter';
import ArtistLinks from './components/artistLinks.vue';
import SongCell from './components/songCell.vue';

defineOptions({
  name: 'FavoriteList'
})

const isMobile = useIsMobile()
const { favorite, playType } = storeToRefs(musicStatus())
const { headerCellStyle, headerRowStyle, rowStyle, cellStyle } = useTableStyle()
// 表格数据用「过滤后的收藏」，关键词来自顶部搜索框（和 searchBar 共用同一个 ref）
const { keyword: favoriteKeyword, filteredFavorite } = useFavoriteFilter()

// 双击播放：切到「我喜欢」作为当前播放列表，上下首就在收藏里轮转
const playChoose = (row) => {
  playType.value = PLAYTYPE.FAVORITE
  musicStatus().setMusicInfo(row)
}

// 再点一次爱心即取消收藏，行会从列表里消失
const toggleFavorite = (row) => {
  musicStatus().toggleFavorite(row)
}

// 收藏里既有搜索结果的字段（artists/album/duration），也有歌单详情的字段（ar/al/dt）
const artistsOf = row => formatArtists(row.artists || row.ar)
const albumOf = row => row.album?.name || row.al?.name || '-'
const durationOf = row => timeFormat((row.duration || row.dt) / 1000)

// 历史收藏来自旧搜索接口，可能没有封面，进页面时批量补一次
onMounted(() => {
  musicStatus().ensureFavoriteCovers()
})
</script>

<template>
  <div class="box-border absolute h-full w-full">
    <!-- 空状态：区分「收藏本来就是空的」和「筛选不到结果」 -->
    <div v-if="!favorite.length" class="flex flex-col items-center justify-center w-full h-full text-slate-300 gap-3">
      <i class="iconfont icon-aixin empty-heart"></i>
      <p class="text-sm">还没有喜欢的歌曲</p>
      <p class="text-xs text-slate-400">在歌曲列表或播放控制栏点一下爱心就能收藏</p>
    </div>
    <div v-else-if="!filteredFavorite.length" class="flex flex-col items-center justify-center w-full h-full text-slate-300 gap-3">
      <i class="iconfont icon-sousuo empty-heart"></i>
      <p class="text-sm">没有找到「{{ favoriteKeyword }}」相关的歌曲</p>
      <p class="text-xs text-slate-400">换个歌名、歌手或专辑试试</p>
    </div>

    <el-table v-else :data="filteredFavorite" row-key="id" :size="isMobile ? 'small' : 'default'"
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
      <!-- 爱心列：点了就取消收藏 -->
      <el-table-column :width="isMobile ? 42 : 52" align="center">
        <template #default="scope">
          <i class="iconfont icon-aixin1-copy favorite-icon is-favorite" title="取消喜欢"
            @click.stop="toggleFavorite(scope.row)"></i>
        </template>
      </el-table-column>
      <el-table-column label="歌曲" :min-width="isMobile ? 140 : 110">
        <template #default="scope">
          <!-- 封面 + 歌名/歌手：封面在歌名左侧 -->
          <SongCell :song="scope.row" :cover-size="isMobile ? 30 : 38">
            <div class="song-name text-style" :title="scope.row.name">{{ scope.row.name }}</div>
            <div class="artist-names text-style" :title="artistsOf(scope.row)">
              <ArtistLinks :artists="scope.row.artists || scope.row.ar" />
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
</template>

<style scoped>
.text-style {
  @apply text-ellipsis overflow-hidden cursor-pointer whitespace-nowrap
}

::v-deep(.el-table__body .el-table__row.hover-row td) {
  background-color: #777b83;
}

::v-deep(.el-table__inner-wrapper::before) {
  height: 0px;
}

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

/* 列表里的爱心 */
.favorite-icon {
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.45);
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

.empty-heart {
  font-size: 2.5rem;
  color: rgba(255, 255, 255, 0.28);
}

@media (max-width: 639.98px) {
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
}
</style>
