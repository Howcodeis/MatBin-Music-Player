<script setup>
import { defineOptions, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { musicStatus } from '@/store'
import { PLAYTYPE } from '@/utils/music'
import { useTableStyle } from '@/composables/useTableStyle'
import { useFavoriteFilter } from '@/composables/useFavoriteFilter'
import VirtualSongList from './components/virtualSongList.vue'

defineOptions({
  name: 'FavoriteList'
})

const { favorite, currentMusicInfo } = storeToRefs(musicStatus())
const { markFavoriteClick, isJustFavorite } = useTableStyle()
// 表格数据用过滤后的收藏，关键词来自顶部搜索框（和 searchBar 共用同一个 ref）
const { keyword: favoriteKeyword, filteredFavorite } = useFavoriteFilter()

// 双击播放：切到我喜欢作为当前播放列表，上下首就在收藏里轮转
const playChoose = row => {
  // 刚点过收藏就不算选中歌曲
  if (isJustFavorite()) return
  // 传当前列表当播放队列：之后再浏览别的歌单/重新搜索，不会替换正在播放的队列
  musicStatus().playFromList(filteredFavorite.value, row, PLAYTYPE.FAVORITE)
}

// 再点一次爱心即取消收藏，行会从列表里消失
const toggleFavorite = row => {
  markFavoriteClick()
  musicStatus().toggleFavorite(row)
}

// 历史收藏来自旧搜索接口，可能没有封面，进页面时批量补一次
onMounted(() => {
  musicStatus().ensureFavoriteCovers()
})
</script>

<template>
  <div class="box-border absolute h-full w-full">
    <!-- 空状态：区分收藏本来就是空的和筛选不到结果 -->
    <div
      v-if="!favorite.length"
      class="flex flex-col items-center justify-center w-full h-full text-slate-300 gap-3"
    >
      <i class="iconfont icon-aixin empty-heart"></i>
      <p class="text-sm">还没有喜欢的歌曲</p>
      <p class="text-xs text-slate-400">在歌曲列表或播放控制栏点一下爱心就能收藏</p>
    </div>
    <div
      v-else-if="!filteredFavorite.length"
      class="flex flex-col items-center justify-center w-full h-full text-slate-300 gap-3"
    >
      <i class="iconfont icon-sousuo empty-heart"></i>
      <p class="text-sm">没有找到「{{ favoriteKeyword }}」相关的歌曲</p>
      <p class="text-xs text-slate-400">换个歌名、歌手或专辑试试</p>
    </div>

    <VirtualSongList
      v-else
      :songs="filteredFavorite"
      :current-id="currentMusicInfo.id"
      @row-click="playChoose"
      @favorite-toggle="toggleFavorite"
    />
  </div>
</template>

<style scoped>
.empty-heart {
  font-size: 2.5rem;
  color: rgba(255, 255, 255, 0.28);
}
</style>
