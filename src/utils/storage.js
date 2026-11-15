/*
 * @Author: Matbin
 * @Date: 2026-11-13
 * @Description: 带防抖的 localStorage 适配器
 *
 * 背景：pinia-plugin-persistedstate 会在每次 state 变更时同步序列化并写入 localStorage。
 * 而播放器在 ontimeupdate 里每 100ms 更新一次 currentTime，
 * 等于每秒把整个 store（歌单 + 歌词 + 评论，实测约 119KB）序列化 10 次，并把同步
 * IO 打到主线程上。这里用防抖把写入合并成低频操作，语义不变（最后一次写胜出）。
 */
const DEBOUNCE_MS = 800
// key -> { timer, value }
const pending = new Map()

const flush = key => {
  const item = pending.get(key)
  if (!item) return
  clearTimeout(item.timer)
  pending.delete(key)
  try {
    localStorage.setItem(key, item.value)
  } catch (error) {
    // 超出配额时清掉旧数据，避免抛错打断播放
    console.warn('[storage] 持久化失败，已清空旧缓存:', error?.message)
    localStorage.removeItem(key)
  }
}

export const debouncedLocalStorage = {
  getItem (key) {
    return localStorage.getItem(key)
  },
  setItem (key, value) {
    const item = pending.get(key)
    if (item) clearTimeout(item.timer)
    pending.set(key, {
      value,
      timer: setTimeout(() => flush(key), DEBOUNCE_MS)
    })
  },
  removeItem (key) {
    const item = pending.get(key)
    if (item) clearTimeout(item.timer)
    pending.delete(key)
    localStorage.removeItem(key)
  }
}

// 页面关闭/切后台时把挂起的写入立即落盘，避免丢状态
if (typeof window !== 'undefined') {
  const flushAll = () => [...pending.keys()].forEach(flush)
  window.addEventListener('pagehide', flushAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
}
