<script setup>
import { computed, defineOptions, nextTick, onMounted, ref, watch } from 'vue'
import { musicStatus } from '@/store'
import { storeToRefs } from 'pinia'
import { PLAYTYPE } from '@/utils/music'
import { useTableStyle, useLoadMore } from '@/composables/useTableStyle'
import ListSkeleton from './components/listSkeleton.vue'
import VirtualSongList from './components/virtualSongList.vue'

defineOptions({
  name: 'PlayList'
})

const store = musicStatus()
const { getPlayList, currentMusicInfo } = storeToRefs(store)
const { markFavoriteClick, isJustFavorite } = useTableStyle()

const listRef = ref(null)
// 搜索进行中：store 里先写 keywords 再发请求，所以 keywords 一变就说明新一轮开始了
const searching = ref(false)

// 关键词变了就是新一轮搜索，先盖骨架屏，避免显示上一轮的结果
watch(
  () => store.keywords,
  () => {
    searching.value = true
  }
)

// searchVersion 在搜索结束时自增，这时候再撤掉骨架
watch(
  () => store.searchVersion,
  async () => {
    searching.value = false
    resetLoadMore()
    await nextTick()
    listRef.value?.scrollToTop()
  }
)

const playChoose = row => {
  // 刚点过收藏就不算选中歌曲
  if (isJustFavorite()) return
  // 传当前列表当播放队列：之后再浏览别的歌单/重新搜索，不会替换正在播放的队列
  musicStatus().playFromList(getPlayList.value, row, PLAYTYPE.SEARCH)
}

// 触底加载：由 useLoadMore 保证同一时间只有一次请求
const { isLoadingMore, handleLoadMore, resetLoadMore } = useLoadMore(async () => {
  const state = musicStatus()
  // 还没有搜索结果时不提示「到底」，那只是空列表而不是翻完了
  if (!state.playList?.length) return null
  // 到底与否由 store 按接口 songCount 判断，不看本页条数
  if (state.searchSettings.isSearchOverCounts) return null
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
    <ListSkeleton v-if="searching" :rows="9" />
    <VirtualSongList
      v-else
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
