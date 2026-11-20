/*
 * @Author: Matbin
 * @Date: 2023-11-21 13:51:04
 * @Description: 音乐请求配置
 */

import http from '../utils/axiosInterceptors'

/*
 * 统一用 params 传参：关键词里出现 & # 空格 等字符时，
 * 手动拼 URL 会被截断或改变语义，axios 会负责 encodeURIComponent。
 */

/**
 * 搜索歌曲
 * @param {string} keywords
 * @param {number} limit
 * @param {number} offset
 * @returns music-list
 */
export const reqMusicList = (keywords, limit, offset) => {
  // 用 /cloudsearch 而不是 /search，原因：
  // /search 的 album 只返回 picId、没有 picUrl，列表拿不到封面；
  // /cloudsearch 返回 al.picUrl，字段也更全（ar/al/dt），分页字段 songCount 一致。
  return http.get('/cloudsearch', { params: { keywords, limit, offset } })
}

/**
 * 获取歌曲资源路径
 * @param {number} id
 * @returns music-url
 */
export const reqSongUrl = id => {
  return http.get('/song/url', { params: { id, level: 'exhigh' } })
}

/**
 * 获取歌曲歌词
 * @param {number} id
 * @returns music-lyric
 */
export const reqSongLyric = id => {
  return http.get('/lyric', { params: { id } })
}

/**
 * 获取歌曲详情
 * 主要是获取封面
 * @param {number} id
 * @returns music-imageUrl
 */
export const reqSongDetail = id => {
  return http.get('/song/detail', { params: { ids: id } })
}

/**
 * 批量获取歌曲详情
 * /song/detail 的 ids 支持逗号分隔，一次拿多首，用于给历史收藏补封面
 * @param {Array<number|string>} ids
 */
export const reqSongDetailBatch = ids => {
  const list = Array.isArray(ids) ? ids.join(',') : String(ids)
  return http.get('/song/detail', { params: { ids: list } })
}

/**
 * 异步请求歌曲评论数据
 *
 * 该函数通过HTTP GET请求获取指定歌曲ID的评论数据。
 *
 * @param {number} id - 歌曲的ID，用于构建请求URL，识别特定歌曲的评论。
 * @returns {Promise} 返回一个Promise对象，解析后的结果为HTTP请求的响应数据。
 */
export const reqSongComment = id => {
  // 取 30 条：歌词页底部每次展示 6 条，翻 5 次刚好看完
  return http.get('/comment/music', { params: { id, limit: 30 } })
}

/**
 * 获取歌手歌曲（可翻页）
 * 说明：/artist/top/song 只能一次拿固定 50 首热门，无法触底加载；
 * /artist/songs 支持 limit/offset，order=hot 时按热度排序，正好满足「30 首一页 + 触底加载」。
 * @param {number} id 歌手 id
 * @param {number} limit 每页数量
 * @param {number} offset 偏移量
 * @param {string} order hot（热门）/ time（时间）
 */
export const reqArtistSongs = (id, limit = 30, offset = 0, order = 'hot') => {
  return http.get('/artist/songs', { params: { id, limit, offset, order } })
}

/**
 * 推荐歌单（首页个性化推荐）
 * 免登录；返回字段带 playCount、trackCount、copywriter、picUrl，适合做卡片
 * @param {number} limit 数量
 */
export const reqPersonalizedPlaylists = (limit = 30) => {
  return http.get('/personalized', { params: { limit } })
}

/**
 * 榜单详情列表
 * 一次返回所有榜单，每个榜单带前 3 首（旧版字段 first/second = 歌名/歌手）
 */
export const reqTopLists = () => {
  return http.get('/toplist/detail')
}

/**
 * 每日推荐歌曲
 * 未登录也会返回一份日推（登录后才是账号专属口味）
 */
export const reqRecommendSongs = () => {
  return http.get('/recommend/songs')
}

/**
 * 歌单详情元信息：名称、封面、作者、标签、简介、播放量、歌曲数
 * @param {number} id 歌单 id
 */
export const reqPlaylistInfo = id => {
  return http.get('/playlist/detail', { params: { id } })
}

/**
 * 获取歌单详情
 * @param {number} id
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise} 返回一个Promise对象，解析后的结果为HTTP请求的响应数据。
 */
export const reqPlayListDetail = (id, limit = 30, offset = 0) => {
  return http.get('/playlist/track/all', { params: { id, limit, offset } })
}
