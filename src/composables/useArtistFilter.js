/*
 * @Description: 「歌手热门」页的本地筛选关键词
 *
 * 和 useFavoriteFilter 同样的思路：
 * 1. 纯视图状态，不放进 store，避免被持久化到 localStorage；
 * 2. 顶部搜索框和歌手表格是两个组件，用模块级 ref 共享，不用事件总线。
 *
 * 说明：网易云没有「在某个歌手范围内搜索」的接口，所以这里是
 * 对已加载的歌手热门歌曲做本地过滤（与「我喜欢的音乐」一致）。
 */
import { computed, ref } from 'vue'
import { musicStatus } from '@/store'

const keyword = ref('')

// 拼一条可搜索文本：歌名 + 歌手 + 专辑，兼容 artists/ar、album/al 两套字段
const searchableText = (song) => {
  const artists = song.artists || song.ar || []
  const artistText = Array.isArray(artists)
    ? artists.map(item => item?.name || '').join(' ')
    : ''
  const album = song.album?.name || song.al?.name || ''
  return `${song.name || ''} ${artistText} ${album}`.toLowerCase()
}

export function useArtistFilter () {
  const store = musicStatus()

  // 关键词为空时直接返回原数组，省掉无意义的 filter
  const filteredArtistSongs = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    if (!kw) return store.artistSongs
    return store.artistSongs.filter(song => searchableText(song).includes(kw))
  })

  const resetArtistKeyword = () => {
    keyword.value = ''
  }

  return { keyword, filteredArtistSongs, resetArtistKeyword }
}
