/*
 * @Author: Matbin
 * @Date: 2026-11-13
 * @Description: 歌曲表格的公共样式与触底加载
 */
import { ref } from 'vue'
import { musicStatus } from '@/store'
import { normalBack } from '@/utils/MessageBack'

// el-table 透明背景样式
export function useTableStyle () {
  const store = musicStatus()

  const headerRowStyle = () => ({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    color: 'white'
  })
  const headerCellStyle = () => ({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    padding: '5px',
    borderBottom: '1px solid black',
  })
  const rowStyle = () => ({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    color: 'white'
  })
  const cellStyle = () => ({
    border: 'none'
  })

  // 正在播放的那一行标出来，切走再回来也能找到位置
  const rowClassName = ({ row }) => (row?.id === store.currentMusicInfo?.id ? 'is-playing-row' : '')

  /*
   * 手机上点收藏，点击有时候会冒泡到整行，误触发播放。
   * 记一下最近点收藏的时间，行点击时跳过紧接着的那一次。
   */
  let favoriteAt = 0
  const markFavoriteClick = () => { favoriteAt = Date.now() }
  const isJustFavorite = () => Date.now() - favoriteAt < 300

  return {
    headerRowStyle,
    headerCellStyle,
    rowStyle,
    cellStyle,
    rowClassName,
    markFavoriteClick,
    isJustFavorite
  }
}

/**
 * 触底加载包装：同一时间只允许一次请求，避免滚动抖动触发重复加载。
 * loader 返回 { added, hasMore } 时，会顺带在顶部提示结果。
 * @param {Function} loader 实际加载函数
 */
export function useLoadMore (loader) {
  const isLoadingMore = ref(false)

  const handleLoadMore = async () => {
    if (isLoadingMore.value) return
    isLoadingMore.value = true
    try {
      const result = await loader()
      if (!result) return
      if (result.hasMore === false) {
        normalBack('info', '已经到底啦', 1500)
      } else if (result.added > 0) {
        normalBack('success', `加载了 ${result.added} 首`, 1200)
      }
    } catch (error) {
      normalBack('warning', '加载失败，请重试')
    } finally {
      isLoadingMore.value = false
    }
  }

  return { isLoadingMore, handleLoadMore }
}

// 歌手名格式化，兼容 artists / ar 两种字段
export const formatArtists = (artists) => {
  if (!Array.isArray(artists)) return ''
  return artists.map(item => item?.name).filter(Boolean).join(' / ')
}
