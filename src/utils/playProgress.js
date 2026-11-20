import { ref } from 'vue'

/*
 * 播放进度。
 *
 * 单独放在 pinia 外面是有原因的：它每 250ms 变一次，
 * 放在持久化的 store 里会触发 pinia 的深度订阅 + 整个 state 的 JSON 序列化，
 * 播放时所有动画都跟着卡。
 */
export const playProgress = ref(0)

/*
 * 当前唱到第几句歌词。
 *
 * 和播放进度一样放在 pinia 外面：它每句歌词都会变（3-5 秒一次），
 * 留在持久化的 state 里会让整包 state 反复序列化，播放时所有动画都跟着卡。
 * 刷新后重新播放会重新算出来，本来也不需要持久化。
 */
export const lyricIndex = ref(-1)

/*
 * 进度落盘。
 * 只在暂停、离开页面这些时机写，不会回到每 250ms 序列化的老路；
 * 记的是「哪首歌听到了哪里」，所以换过歌之后 id 对不上，不会误恢复。
 */
const STORAGE_KEY = 'music-play-progress'

/**
 * 记住某首歌听到哪儿了
 * @param {string|number} id 歌曲 id
 * @param {number} time 秒
 */
export function persistProgress(id, time) {
  if (!id || !Number.isFinite(time) || time <= 0) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: String(id), time }))
  } catch (error) {
    // 隐私模式或配额满时静默失败，不影响播放
  }
}

/**
 * 读回某首歌上次的位置
 * @param {string|number} id 歌曲 id
 * @returns {number} 秒，没有记录或不是同一首歌返回 0
 */
export function readPersistedProgress(id) {
  if (!id) return 0
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!raw || String(raw.id) !== String(id)) return 0
    const time = Number(raw.time)
    return Number.isFinite(time) && time > 0 ? time : 0
  } catch (error) {
    return 0
  }
}
