/*
 * @Description: 页面级滚动位置记忆
 *
 * 滚动容器在 MusicLayout 的 overflow-scroll 上，路由切换时容器不变，
 * 但内容变矮会把 scrollTop 钳到 0（例如热门歌单 → 歌单详情再返回）。
 * 这里用一个模块级 Map 按 key 暂存 scrollTop，离开前 save、回来渲染完后 take。
 * take 取完即删，保证只恢复一次，不会影响下次正常进入。
 */
const saved = new Map()

/**
 * 记住某个滚动容器的当前位置
 * @param {string} key 页面标识
 * @param {HTMLElement|null} scroller 滚动容器
 */
export function saveScroll (key, scroller) {
  if (!scroller) return
  saved.set(key, scroller.scrollTop)
}

/**
 * 取出并清除某个页面的滚动位置
 * @param {string} key 页面标识
 * @returns {number}
 */
export function takeScroll (key) {
  const top = saved.get(key) || 0
  saved.delete(key)
  return top
}

/**
 * 清除某个页面的滚动记忆（例如去了别的模块，下次不该停在上次位置）
 * @param {string} key 页面标识
 */
export function clearScroll (key) {
  saved.delete(key)
}
