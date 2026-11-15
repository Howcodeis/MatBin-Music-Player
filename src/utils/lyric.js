/*
 * @Author: Matbin
 * @Date: 2026-11-13
 * @Description: LRC 歌词解析（纯函数，不依赖网络与 DOM，可直接单测）
 *
 */

// [mm:ss] [mm:ss.SS] [mm:ss.SSS] [mm:ss:SS]
const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
// [offset:±ms]
const OFFSET_TAG = /\[offset:\s*([+-]?\d+)\s*\]/i

// 把 [mm:ss.xx] 解析成秒，小数部分按位数折算（.5 = 500ms，.50 = 500ms，.500 = 500ms）
const toSeconds = (minute, second, fraction) => {
  const frac = fraction ? Number(fraction.padEnd(3, '0').slice(0, 3)) / 1000 : 0
  return Number(minute) * 60 + Number(second) + frac
}

// 解析单行，返回该行上的所有时间点（可能为空数组）
const parseLine = (line) => {
  if (!line) return []
  const timestamps = []
  for (const match of line.matchAll(TIME_TAG)) {
    const seconds = toSeconds(match[1], match[2], match[3])
    if (Number.isFinite(seconds)) timestamps.push(seconds)
  }
  if (timestamps.length === 0) return []
  const word = line.replace(TIME_TAG, '').trim()
  return timestamps.map(time => ({ time: Math.round(time * 100) / 100, word }))
}

/**
 * 解析 LRC 文本
 * @param {string} raw LRC 原文
 * @returns {Array<{time: number|null, word: string}>}
 *   - 有时间轴：按时间升序、同时间同文本去重
 *   - 无时间轴（纯文本歌词）：time 全部为 null
 */
export function parseLrc (raw) {
  if (typeof raw !== 'string' || !raw.trim()) return []

  const offsetMatch = raw.match(OFFSET_TAG)
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0

  const lines = raw.split('\n').flatMap(parseLine)

  // 完全没有时间标签：当作纯文本歌词
  if (lines.length === 0) {
    return raw.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(word => ({ time: null, word }))
  }

  const seen = new Set()
  return lines
    .map(line => ({ time: Math.round((line.time + offset) * 100) / 100, word: line.word }))
    .filter(line => line.time >= 0 && line.word !== '')
    .sort((a, b) => a.time - b.time)
    .filter(line => {
      const key = `${line.time}|${line.word}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/**
 * @Author: Matbin
 * @Date: 2026-11-13
 * @Description: 把翻译歌词（tlyric）按时间戳对齐到原词上，产出带 tword 字段的数组。
 *
 * @param {Array<{time:number|null, word:string}>} lyric 原词，需按时间升序
 * @param {Array<{time:number|null, word:string}>} tlyric 翻译词
 * @param {number} tolerance 允许的时间偏差，单位秒
 * @returns {Array} 新数组，匹配上的行带 tword 字段
 */
export function withTranslation (lyric, tlyric, tolerance = 0.6) {
  if (!Array.isArray(lyric) || lyric.length === 0) return []
  if (!Array.isArray(tlyric) || tlyric.length === 0) return lyric

  const lyricHasTime = lyric[0]?.time != null
  const tlyricHasTime = tlyric[0]?.time != null

  // 只要一侧没有时间轴，就只能按行号对齐
  if (!lyricHasTime || !tlyricHasTime) {
    return lyric.map((line, index) => {
      const word = tlyric[index]?.word
      return word ? { ...line, tword: word } : { ...line }
    })
  }

  const times = tlyric.map(item => item.time)
  return lyric.map(line => {
    let low = 0
    let high = times.length - 1
    let best = -1
    let bestDiff = Infinity

    while (low <= high) {
      const mid = (low + high) >> 1
      const diff = Math.abs(times[mid] - line.time)
      if (diff < bestDiff) {
        bestDiff = diff
        best = mid
      }
      if (times[mid] < line.time) low = mid + 1
      else high = mid - 1
    }

    const matched = best >= 0 && bestDiff <= tolerance ? tlyric[best].word : ''
    return matched ? { ...line, tword: matched } : { ...line }
  })
}
