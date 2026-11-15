/*
 * @Author: Matbin
 * @Date: 2023-11-17
 * @Description: 音乐领域的常量与纯函数
 *
 * 从原来的 components/music/musicTools.js 拆出。
 * 这里只放无副作用、不依赖网络请求的逻辑，保持在依赖链底部；
 * 接口请求封装见 api/musicService.js。
 */

/*
 * @Description: 音乐播放模式以及播放列表模式
 */
export const PLAYMODEL = [
  "LISTLOOP", // 列表循环
  "RANDOM", // 随机播放
  "SINGLELOOP" // 单曲循环
]
export const PLAYTYPE = {
  FAVORITE: "FAVORITE", //收藏歌单
  SEARCH: "SEARCH", // 搜索歌单
  HOT: "HOT", // 歌单详情
  ARTIST: "ARTIST", // 歌手热门
  DAILY: "DAILY", // 每日推荐
}

/**
 * 播放量/收藏数格式化：1.2万、3.4亿
 * 用于歌单卡片和详情头部，避免一长串数字占位置
 */
export const formatCount = (count) => {
  const n = Number(count)
  if (!Number.isFinite(n) || n < 0) return '0'
  const trim = v => v.toFixed(1).replace(/\.0$/, '')
  if (n >= 1e8) return `${trim(n / 1e8)}亿`
  if (n >= 1e4) return `${trim(n / 1e4)}万`
  return String(Math.floor(n))
}

/**
 * 网易云图床在部分接口里返回 http://，https 部署会被混合内容拦截；
 * 同一路径 https 可访问，这里统一升级。
 */
export const toHttps = (url) => String(url || '').replace(/^http:\/\//i, 'https://')

/*
 * @Description: 随机播放状态值
 * 说明：原实现用递归且漏传 len，递归结果被丢弃后返回 undefined，
 * 导致约 1/len 的概率切歌失败。改为循环取值，天然不会返回 undefined。
 */
const randomPlay = (index, len) => {
  // 只有一首歌（或列表为空）时只能停在原地
  if (len <= 1) return index < 0 ? 0 : index
  let nextIndex = Math.floor(Math.random() * len)
  // 避免随机到当前索引；len > 1 时循环必然收敛
  while (nextIndex === index) {
    nextIndex = Math.floor(Math.random() * len)
  }
  return nextIndex
}

/*
 * @Description: 顺序播放状态值
 */
const listPlay = (index, len, isPlayNext) => {
  if (!len) return 0
  let nextIndex
  if (isPlayNext) {
    if (index == len - 1) {
      nextIndex = 0
    } else if (index != -1) {
      nextIndex = index + 1
    } else {
      nextIndex = 0
    }
  } else {
    if (index == 0) {
      nextIndex = len - 1
    } else if (index != -1) {
      nextIndex = index - 1
    } else {
      nextIndex = 0
    }
  }
  return nextIndex
}

/**
 * @Description: 获取下一首歌曲的索引
 * @param {Array} tempList - 当前生效的歌曲列表
 * @param {string} playMode - 播放模式
 * @param {boolean} isPlayNext - 是否播放下一首
 * @param {object} currentMusicInfo - 当前歌曲信息
 */
export const getNextSong = (tempList, playMode, isPlayNext, currentMusicInfo) => {
  if (!Array.isArray(tempList) || tempList.length === 0) return -1
  let index = tempList.findIndex(item => item?.id == currentMusicInfo?.id)
  let len = tempList.length
  if (playMode === "RANDOM") {
    return randomPlay(index, len)
  } else {
    return listPlay(index, len, isPlayNext)
  }
}

/*
 * @Description: 播放时间和总时间
 */
export const timeFormat = (time) => {
  // 非法输入（NaN / Infinity / 负数）统一回退，避免出现 "NaN:NaN"
  if (!Number.isFinite(time) || time < 0) return '00:00'
  let minute = Math.floor(time / 60),
    second = Math.floor(time) - minute * 60;
  if (minute <= 9) minute = `0${minute}`;
  if (second <= 9) second = `0${second}`;
  return minute + ":" + second;
}

/*
 * @Description: 播放进度百分比
 */
export const PercentageOfProgress = (currentTime, duration) => {
  // duration 为 0 / NaN 时百分比无意义，直接回退 0
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) return 0
  return Math.floor((currentTime / duration) * 1000) / 10
}

/*
 * @Description: 播放时间
 */
export const TimeOfProgress = (currentTime) => {
  return timeFormat(currentTime)
}
