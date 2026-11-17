<script setup>
import { defineOptions, nextTick, onMounted, ref, watch } from 'vue';
import { musicStatus } from '@/store';
import { storeToRefs } from 'pinia';
import { timeFormat, PLAYTYPE } from '@/utils/music';
import { useTableStyle, useLoadMore, formatArtists } from '@/composables/useTableStyle';
import { useIsMobile } from '@/composables/useResponsive';
import ArtistLinks from './components/artistLinks.vue';
import SongCell from './components/songCell.vue';

defineOptions({
  name: 'PlayList'
})

// 窄屏收起专辑列，把宽度让给歌曲名
const isMobile = useIsMobile()

const { headerCellStyle, headerRowStyle, rowStyle, cellStyle, rowClassName, markFavoriteClick, isJustFavorite } = useTableStyle()

const store = musicStatus()
// el-table 实例：用来把内部滚动条复位（表格是固定高度，滚动发生在表格内部）
const tableRef = ref(null)

// 双击播放
const { getPlayList, playType } = storeToRefs(store)
const playChoose = (row) => {
  // 刚点过收藏就不算选中歌曲
  if (isJustFavorite()) return
  // 切换歌曲前更换播放类型 搜索类型
  playType.value = PLAYTYPE.SEARCH
  musicStatus().setMusicInfo(row)
}

// 触底加载：由 useLoadMore 保证同一时间只有一次请求
const { isLoadingMore, handleLoadMore } = useLoadMore(async () => {
  const state = musicStatus()
  // 数据不满一页说明没有下一页
  if (!state.playList?.length || state.playList.length < state.searchSettings.searchLimit) {
    return { added: 0, hasMore: false }
  }
  const before = state.playList.length
  await state.loadMore()
  return {
    added: state.playList.length - before,
    hasMore: !state.searchSettings.isSearchOverCounts
  }
})

// 收藏：爱心在序号右侧，点击只切换收藏，不触发播放
const isFavorite = id => musicStatus().isFavorite(id)
const toggleFavorite = row => {
  markFavoriteClick()
  musicStatus().toggleFavorite(row)
}

// 持久化下来的旧搜索列表可能没有封面，进页面时批量补一次
onMounted(() => {
  store.fillMissingCovers(store.playList)
})

/*
 * 新搜索拿到新结果后，把表格内部滚动条复位到顶部。
 * searchVersion 只在 setMusicList（新搜索）里自增；触底加载走 loadMore，不会误触发。
 * 等 nextTick 让新数据渲染完再复位，否则还是旧表格的高度。
 */
watch(() => store.searchVersion, async () => {
  await nextTick()
  tableRef.value?.setScrollTop?.(0)
})
</script>

<template>
  <div class="box-border absolute h-full w-full">
    <el-table ref="tableRef" :data="getPlayList" row-key="id" v-el-table-infinite-scroll="handleLoadMore"
      :size="isMobile ? 'small' : 'default'"
      :style="{ width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0)' }" @row-click="playChoose"
      :header-cell-style="headerCellStyle" :header-row-style="headerRowStyle" :row-style="rowStyle"
      :cell-style="cellStyle" :row-class-name="rowClassName">
      <el-table-column fixed :width="isMobile ? 38 : 60" label="#">
        <template #default="scope">
          <div class="index-num text-gray-200 select-none">
            {{ (scope.$index + 1) < 10 ? "0" + (scope.$index + 1) : (scope.$index + 1) }} </div>
        </template>
      </el-table-column>
      <!-- 爱心列：序号之后、歌名之前 -->
      <el-table-column :width="isMobile ? 42 : 52" align="center">
        <template #default="scope">
          <i class="iconfont favorite-icon"
            :class="isFavorite(scope.row.id) ? 'icon-aixin1-copy is-favorite' : 'icon-aixin'"
            :title="isFavorite(scope.row.id) ? '取消喜欢' : '加入我喜欢的音乐'" @click.stop="toggleFavorite(scope.row)"></i>
        </template>
      </el-table-column>
      <el-table-column label="歌曲" :min-width="isMobile ? 140 : 110">
        <template #default="scope">
          <!-- 封面 + 歌名/歌手：封面在歌名左侧 -->
          <SongCell :song="scope.row" :cover-size="isMobile ? 30 : 38">
            <div class="song-name text-style" :title="scope.row.name">{{ scope.row.name }}</div>
            <!-- 艺人名称：逐个可点，点进该歌手的热门页 -->
            <div class="artist-names text-style" :title="formatArtists(scope.row.artists || scope.row.ar)">
              <ArtistLinks :artists="scope.row.artists || scope.row.ar" />
            </div>
          </SongCell>
        </template>
      </el-table-column>
      <!-- 专辑名称：窄屏隐藏，避免挤压歌曲信息 -->
      <el-table-column v-if="!isMobile" label="专辑" min-width="100">
        <template #default="scope">
          <div class="text-style text-[12px]" :title="scope.row.album?.name || scope.row.al?.name">
            {{ scope.row.album?.name || scope.row.al?.name || '-' }}
          </div>
        </template>
      </el-table-column>
      <!-- 歌曲时长 -->
      <el-table-column label="时长" :width="isMobile ? 52 : undefined">
        <template #default="scope">
          <div class="duration">
            {{ timeFormat((scope.row.duration || scope.row.dt) / 1000) }}
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 触底加载中 -->
    <div v-if="isLoadingMore" class="load-more-mask">
      <span class="load-more-spinner"></span>
    </div>
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
  /* gray-300 */
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

.favorite-icon.is-favorite {
  color: #ff6b81;
}

/* 窄屏：整体降一档字号，保证一屏能看到更多行且不被截断 */
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

  /* 窄屏隐藏固定列的阴影，避免占掉仅有的可视宽度 */
  ::v-deep(.el-table-fixed-column--left.is-last-column::before) {
    box-shadow: none;
  }
}
</style>
