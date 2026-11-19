<script setup>
import { computed, defineOptions, nextTick, onMounted, ref, watch } from 'vue'
import { musicStatus } from '@/store'
import { storeToRefs } from 'pinia'
import { PLAYTYPE } from '@/utils/music'
import { useTableStyle, useLoadMore } from '@/composables/useTableStyle'
import VirtualSongList from './components/virtualSongList.vue'

defineOptions({
  name: 'PlayList'
})

const store = musicStatus()
const { getPlayList, playType, currentMusicInfo } = storeToRefs(store)
const { markFavoriteClick, isJustFavorite } = useTableStyle()

const listRef = ref(null)

const playChoose = row => {
  // 刚点过收藏就不算选中歌曲
  if (isJustFavorite()) return
  playType.value = PLAYTYPE.SEARCH
  musicStatus().setMusicInfo(row)
}

// 触底加载：由 useLoadMore 保证同一时间只有一次请求
const { isLoadingMore, handleLoadMore, resetLoadMore } = useLoadMore(async () => {
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

const toggleFavorite = row => {
  markFavoriteClick()
  musicStatus().toggleFavorite(row)
}

const hasMore = computed(() => !store.searchSettings.isSearchOverCounts)

// 新搜索后把列表滚回顶部，并允许重新触底加载
watch(
  () => store.searchVersion,
  async () => {
    resetLoadMore()
    await nextTick()
    listRef.value?.scrollToTop()
  }
)

// 持久化下来的旧搜索列表可能没有封面，进页面时批量补一次
onMounted(() => {
  store.fillMissingCovers(store.playList)
})
</script>

<template>
  <div class="box-border absolute h-full w-full">
    <VirtualSongList
      ref="listRef"
      :songs="getPlayList"
      :current-id="currentMusicInfo.id"
      :loading="isLoadingMore"
      :has-more="hasMore"
      @row-click="playChoose"
      @favorite-toggle="toggleFavorite"
      @load-more="handleLoadMore"
    />
  </div>
</template>
