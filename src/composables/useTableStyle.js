/*
 * @Author: Matbin
 * @Date: 2026-11-13
 * @Description: 歌曲表格的公共样式与触底加载
 *
 * 原来 playList.vue 和 hotPlayList.vue 各写了一份完全相同的 4 个样式函数，
 * 且都用「4 秒一次 + 弹提示」的方式限制触底频率，滚动快时会刷屏。
 * 这里统一成一份，并用 loading 标记做真正的并发保护。
 */
import { ref } from 'vue'

// el-table 透明背景样式
export function useTableStyle () {
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
  return { headerRowStyle, headerCellStyle, rowStyle, cellStyle }
}

/**
 * 触底加载包装：同一时间只允许一次请求，避免滚动抖动触发重复加载
 * @param {Function} loader 实际加载函数
 */
export function useLoadMore (loader) {
  const isLoadingMore = ref(false)
  const handleLoadMore = async () => {
    if (isLoadingMore.value) return
    isLoadingMore.value = true
    try {
      await loader()
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
