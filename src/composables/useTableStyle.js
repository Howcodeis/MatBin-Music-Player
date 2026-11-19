/*
 * 歌曲列表的公共逻辑。
 * el-table 已经换成虚拟列表，这里只剩触底加载和收藏防误触。
 */
import { ref } from 'vue'
import { normalBack } from '@/utils/MessageBack'

/*
 * 手机上点收藏，点击有时候会冒泡到整行，误触发播放。
 * 记一下最近点收藏的时间，行点击时跳过紧接着的那一次。
 */
export function useTableStyle() {
  let favoriteAt = 0
  const markFavoriteClick = () => {
    favoriteAt = Date.now()
  }
  const isJustFavorite = () => Date.now() - favoriteAt < 300
  return { markFavoriteClick, isJustFavorite }
}

/**
 * 触底加载包装：同一时间只允许一次请求，避免滚动抖动触发重复加载。
 * loader 返回 { added, hasMore } 时，会顺带在顶部提示结果。
 * @param {Function} loader 实际加载函数
 */
export function useLoadMore(loader) {
  const isLoadingMore = ref(false)
  // 到底之后就不再触发，否则数据不足一屏时滚动容器永远在底部，会反复请求
  let reachedEnd = false

  const handleLoadMore = async () => {
    if (isLoadingMore.value || reachedEnd) return
    isLoadingMore.value = true
    try {
      const result = await loader()
      if (!result) return
      if (result.hasMore === false) {
        reachedEnd = true
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

  // 换了搜索词 / 换了歌单之后要能重新加载
  const resetLoadMore = () => {
    reachedEnd = false
  }

  return { isLoadingMore, handleLoadMore, resetLoadMore }
}
