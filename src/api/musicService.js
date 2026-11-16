/*
 * @Author: Matbin
 * @Date: 2023-11-21
 * @Description: 音乐业务服务层
 *
 * 这些函数是 api/reqMusic.js 的上层封装：发请求 + 校验 code + 清洗返回数据。
 * 纯常量与格式化函数在 utils/music.js。
 */
import { reqMusicList, reqSongDetail, reqSongDetailBatch, reqSongLyric, reqSongUrl, reqSongComment, reqPersonalizedPlaylists, reqRecommendSongs, reqPlaylistInfo, reqPlayListDetail, reqArtistSongs } from "./reqMusic";
import { parseLrc } from "@/utils/lyric";
import { toHttps } from "@/utils/music";

/**
 * @Description: 获取音乐路径
 * @param {number} id
 * @returns 音乐数据，主要获取音乐路径
 */
export const getSongUrl = async (id) => {
  const res = await reqSongUrl(id)
  // code 不是 200 才是真正的接口异常（网络/服务端问题），需要上层提示重试
  if (res?.code != 200) throw new Error("获取歌曲路径失败")
  // 无版权 / 已下架：接口仍返回 200，但 data 里是 null 或 url 为 null。
  // 这种情况不算出错，返回 null 交给上层按不可播放处理（停播 + 自动跳过），
  // 否则会被当成接口异常，列表里一遇灰色歌曲就停在原地。
  const song = res?.data?.[0]
  if (!song?.url) return null
  /*
   * 网易云返回的播放地址经常是 http://m702.music.126.net/...。
   * 本地开发页面是 http，没问题；但站点一旦部署到 https，
   * 浏览器会按「混合内容」直接拦掉这个音频请求 —— 表现就是歌点了不响、控制台报
   * Mixed Content。同一路径 https 可正常访问，所以这里统一升级，
   * 让开发环境和线上环境行为一致。
   */
  return { ...song, url: toHttps(song.url) }
}

/**
 * @Description: 处理歌词
 * 解析细节见 utils/lyric.js：那里只认数字时间标签，支持一行多时间戳、offset 偏移，
 * 并按时间排序去重，保证 store 里二分查找的前置条件成立。
 * @param {number} id
 * @returns {{ lyric: Array, tlyric: Array }} 原词与官方翻译，均已完成解析
 */
export const getSongLyric = async (id) => {
  const res = await reqSongLyric(id)
  if (res?.code != 200) throw new Error("获取歌词失败")
  // 纯音乐、接口降级时 lrc / tlyric 可能为 null，统一兜底成空字符串
  // tlyric 是官方的中文翻译歌词，和原词一样带时间戳
  return {
    lyric: parseLrc(res?.lrc?.lyric || ''),
    tlyric: parseLrc(res?.tlyric?.lyric || '')
  }
}

/**
 * @Description: 返回歌曲详情
 * @param {number} id
 * @returns 歌曲详情数组
 */
export const getSongDetails = async (id) => {
  const res = await reqSongDetail(id)
  if (res?.code == 200 && res.songs?.length) return res.songs
  else throw new Error("获取歌曲详情失败")
}

/**
 * @Description: 批量获取歌曲详情（用于给历史收藏补封面）
 * @param {Array<number|string>} ids
 * @returns 歌曲详情数组（含 al.picUrl）
 */
export const getSongDetailBatch = async (ids) => {
  const list = Array.isArray(ids) ? ids : [ids]
  if (!list.length) return []
  const res = await reqSongDetailBatch(list)
  if (res?.code == 200 && Array.isArray(res.songs)) return res.songs
  throw new Error("批量获取歌曲详情失败")
}

/**
 * @Description: 返回歌曲列表
 * @param {string} keywords 搜索关键词
 * @param {number} limit 每页数量
 * @param {number} offset 偏移量
 */
export const getMusicList = async (keywords, limit, offset) => {
  const res = await reqMusicList(keywords, limit, offset)
  if (res?.code == 200) return res.result
  else throw new Error("获取歌曲列表失败")
}

/**
 * @param {number} id
 * @returns 歌曲评论
 */
export const getSongComment = async (id) => {
  const res = await reqSongComment(id)
  if (res?.code == 200) return res.comments || []
  else throw new Error("获取歌曲评论失败")
}

/**
 * @Description: 获取歌手歌曲（分页，热门优先）
 * @param {number} id 歌手 id
 * @param {number} limit 每页数量
 * @param {number} offset 偏移量
 * @returns {{ songs: Array, more: boolean }}
 */
export const getArtistSongs = async (id, limit = 30, offset = 0) => {
  const res = await reqArtistSongs(id, limit, offset, 'hot')
  if (res?.code != 200) throw new Error("获取歌手歌曲失败")
  const songs = Array.isArray(res.songs) ? res.songs : []
  // 接口返回 more 时以它为准；个别版本不返回，则用「本页是否满额」推断还有没有下一页
  const more = typeof res.more === 'boolean' ? res.more : songs.length >= limit
  return { songs, more }
}

/**
 * @Description: 推荐歌单（首页个性化推荐）
 * @param {number} limit 数量
 * @returns 歌单数组，含 playCount / trackCount / copywriter / picUrl
 */
export const getPersonalizedPlaylists = async (limit = 30) => {
  const res = await reqPersonalizedPlaylists(limit)
  if (res?.code == 200) return res.result || []
  throw new Error("获取推荐歌单失败")
}

/**
 * @Description: 每日推荐歌曲
 * @returns 歌曲数组（ar / al / dt 结构）
 */
export const getDailySongs = async () => {
  const res = await reqRecommendSongs()
  if (res?.code == 200) return res?.data?.dailySongs || []
  throw new Error("获取每日推荐失败")
}

/**
 * @Description: 歌单详情元信息
 * @param {number} id 歌单 id
 * @returns 歌单对象（name / coverImgUrl / creator / tags / trackCount / playCount / description）
 */
export const getPlaylistInfo = async (id) => {
  const res = await reqPlaylistInfo(id)
  if (res?.code == 200 && res.playlist) return res.playlist
  throw new Error("获取歌单信息失败")
}

/**
 * 获取热门播放列表详情
 * @param {number} id 播放列表ID
 * @param {number} [limit=30] 返回数量限制，默认为30
 * @param {number} [offset=0] 偏移量，默认为0
 * @returns {Promise<Object>} 返回播放列表详情数据
 * @throws {Error} 当ID无效或请求失败时抛出错误
 */
export const getPlaylistSongs = async (id, limit = 30, offset = 0) => {
  const res = await reqPlayListDetail(id, limit, offset)
  if (res?.code == 200) return res
  throw new Error("获取歌单歌曲失败")
}
