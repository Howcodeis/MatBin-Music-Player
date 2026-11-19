/*
 * @Author: Matbin
 * @Date: 2026-11-13
 * @Description: 「我喜欢的音乐」页的本地筛选关键词
 *
 * 放在模块级 composable 而不是 store 里，有两个原因：
 * 1. 这是纯视图状态，不该被持久化到 localStorage；
 * 2. 搜索框和收藏表格是两个不同组件，用同一个模块级 ref 就能共享，不用事件总线。
 */
import { computed, ref } from 'vue'
import { musicStatus } from '@/store'

const keyword = ref('')

/**
 * 拼出一条歌曲的可搜索文本：歌名 + 歌手 + 专辑
 * 收藏里既有搜索结果的字段（artists/album），也有歌单详情的字段（ar/al）
 */
const searchableText = song => {
  const artists = song.artists || song.ar || []
  const artistText = Array.isArray(artists) ? artists.map(item => item?.name || '').join(' ') : ''
  const album = song.album?.name || song.al?.name || ''
  return `${song.name || ''} ${artistText} ${album}`.toLowerCase()
}

export function useFavoriteFilter() {
  const store = musicStatus()

  // 关键词为空时直接返回原数组，避免无谓的 filter 开销
  const filteredFavorite = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    if (!kw) return store.favorite
    return store.favorite.filter(song => searchableText(song).includes(kw))
  })

  return { keyword, filteredFavorite }
}
