/*
 * @Author: Matbin
 * @Date: 2026-11-13
 * @Description: 带防抖的 localStorage 适配器
 *
 */
const DEBOUNCE_MS = 800
// key -> { timer, value }
const pending = new Map()
// key -> 上次真正写进 localStorage 的内容，用来跳过重复写入
const lastWritten = new Map()

const flush = key => {
  const item = pending.get(key)
  if (!item) return
  clearTimeout(item.timer)
  pending.delete(key)
  // 内容没变就不写：播放时 currentTime 等高频字段变化，序列化结果其实是一样的
  if (lastWritten.get(key) === item.value) return
  try {
    localStorage.setItem(key, item.value)
    lastWritten.set(key, item.value)
  } catch (error) {
    // 超出配额时清掉旧数据，避免抛错打断播放
    console.warn('[storage] 持久化失败，已清空旧缓存:', error?.message)
    localStorage.removeItem(key)
    lastWritten.delete(key)
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
    lastWritten.delete(key)
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
