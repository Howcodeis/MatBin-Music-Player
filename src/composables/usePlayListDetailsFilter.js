/*
 * @Author: Matbin
 * @Date: 2026-11-13
 * @Description: 「歌单详情」页的本地筛选关键词
 *
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

export function usePlayListDetailsFilter() {
  const store = musicStatus()

  // 关键词为空时直接返回原数组，避免无谓的 filter 开销
  const filteredPlayListDetails = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    if (!kw) return store.playlistSongs
    return store.playlistSongs.filter(song => searchableText(song).includes(kw))
  })

  return { keyword, filteredPlayListDetails }
}
