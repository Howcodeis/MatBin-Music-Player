/*
 * @Author: Matbin
 * @Date: 2023-11-21 15:32:08
 * @Description: pinia 配置
 */
import { defineStore } from 'pinia'
// 请求封装（业务服务层）
import {
  getMusicList,
  getSongDetails,
  getSongLyric,
  getSongUrl,
  getSongComment,
  getPersonalizedPlaylists,
  getDailySongs,
  getPlaylistInfo,
  getPlaylistSongs,
  getArtistSongs,
  getSongDetailBatch
} from '@/api/musicService'
// 常量与纯函数
import { PLAYMODEL, PLAYTYPE, getNextSong } from '@/utils/music'
import { ref } from 'vue'
import { normalBack } from '../utils/MessageBack'
import { debouncedLocalStorage } from '../utils/storage'
import { playProgress, persistProgress, readPersistedProgress } from '../utils/playProgress'
import { withTranslation } from '../utils/lyric'

const audio = new Audio()
const closeBeforeVolume = ref(0)
// 上一次播放失败的地址，用于阻断失败 -> 重新拉地址 -> 再次失败的死循环
let lastFailedUrl = ''
// 切歌中标记，避免 ended 在高频 timeupdate 里被重复触发
let switching = false
/*
 * 后台加载的请求序号。
 * 切歌没有全屏遮罩，用户可能连续点好几首；每次切歌领取新序号，旧请求返回时直接丢弃，
 * 避免旧歌覆盖新歌、或弹出「正在播放：上一首」这种错消息。
 */
let loadSeq = 0
// 上一次注册的 loadedmetadata 续播回调，切歌前要摘掉，否则会把新歌的进度跳到旧位置
let pendingSeek = null
/*
 * 遇到无版权 / 无播放地址的歌曲时，连续自动跳过的次数与上限。
 * 整张列表都不可播（比如收藏夹里全是灰色歌）时，无限往下跳会一直发请求、一直闪，
 * 到上限就停下来并提示用户。正常播出一首歌后计数清零。
 */
let autoSkipCount = 0
const MAX_AUTO_SKIP = 5
// 单曲循环模式值
const SINGLE_LOOP = PLAYMODEL[2]

/*
 * 本地日期键（YYYY-MM-DD）。
 * dailySongs 会持久化到 localStorage，靠这个日期判断拿到的还是不是今天的数据。
 */
const todayKey = () => {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export const musicStatus = defineStore('musicinfo', {
  // readAndWrite
  state: () => ({
    keywords: '', // 搜索
    searchVersion: 0, // 每次新搜索自增，列表页据此把表格滚动复位到顶部
    playType: PLAYTYPE.SEARCH, // 播放列表
    playMode: PLAYMODEL[0], // 播放顺序
    currentMusic: '', // 当前歌曲
    playList: [], // 音乐列表
    favorite: [], // 收藏歌单
    recommendedPlayLists: [], // 推荐歌单（热门歌单页）
    dailySongs: [], // 每日推荐（发现音乐页）
    dailySongsDate: '', // 上次成功获取日推的本地日期（YYYY-MM-DD），用于判断跨天
    playlistSongs: [], // 选中歌单的歌曲
    playlistInfo: {
      id: '',
      name: '',
      cover: '',
      creator: '',
      tags: [],
      trackCount: 0,
      playCount: 0,
      description: ''
    }, // 歌单元信息
    artistSongs: [], // 歌手热门歌曲
    artistInfo: { id: '', name: '' }, // 当前查看的歌手
    volume: 0.5, // 初始播放音量
    isPlay: false, // 是否播放
    isShowScrollLyrics: false, // 是否展示歌词滚动界面
    isShowAnimationLyrics: false, // 是否展示歌词特殊界面
    isTouch: false, // 是否拖动进度条
    isLoadingMusic: false, // 歌曲信息加载状态
    currentMusicInfo: {
      name: '', // 当前歌曲名
      id: '', // 当前歌曲id
      url: '', // 音乐链接
      cover: '', // 音乐封面
      lyric: [], // 歌词
      artists: '', //艺人
      album: '', //专辑
      currentLyricIndex: -1, // 当前歌词所在索引（-1 表示尚未进入第一句）
      currentTime: 0, // 当前播放时间（秒，进度条直接绑这个值）
      duration: 0, // 歌曲总时长
      comments: []
    },
    searchSettings: {
      searchLimit: 30,
      playlistLimit: 30,
      artistLimit: 30,
      searchOffset: 0,
      playlistOffset: 0,
      artistOffset: 0,
      isSearchOverCounts: false, // 搜索是否到底
      isPlaylistOverCounts: false, // 歌单歌曲是否到底
      isArtistOverCounts: false // 歌手歌曲是否到底
    }
  }),
  // readOnly
  getters: {
    getKeywords() {
      return this.keywords
    },
    getPlayType() {
      return this.playType
    },
    getPlayMode() {
      return this.playMode
    },
    getCurrentMusic() {
      return this.currentMusic
    },
    getCurrentLyricIndex() {
      return this.currentMusicInfo.currentLyricIndex
    },
    getPlayList() {
      return this.playList
    },
    getFavorite() {
      return this.favorite
    },
    /**
     * 判断某首歌是否已在我喜欢里
     * 返回函数形式，调用处直接 isFavorite(id)；收藏列表很小，不做缓存影响不大
     */
    isFavorite() {
      return id => this.favorite.some(item => item?.id === id)
    },
    // 播放进度不在 state 里（见 utils/playProgress），这里只是方便组件取值
    getCurrentTime() {
      return playProgress.value
    },
    getDuration() {
      return this.currentMusicInfo.duration
    },
    getSongComment() {
      return this.currentMusicInfo.comments
    },
    getVolume() {
      return this.volume
    },
    getIsplay() {
      return this.isPlay
    },
    getIsShowLyricsPanel() {
      return this.isShowScrollLyrics
    },
    getIsShowSPLyricsPanel() {
      return this.isShowAnimationLyrics
    },
    getIsTouch() {
      return this.isTouch
    },
    getCurrentMusicInfo() {
      return this.currentMusicInfo
    },
    getSearchSettings() {
      return this.searchSettings
    },
    getRecommendedPlayLists() {
      return this.recommendedPlayLists
    },
    getDailySongs() {
      return this.dailySongs
    },
    getPlaylistSongs() {
      return this.playlistSongs
    },
    getPlaylistInfo() {
      return this.playlistInfo
    },
    getArtistSongs() {
      return this.artistSongs
    },
    getArtistInfo() {
      return this.artistInfo
    }
  },
  // hooks
  actions: {
    // 初始化音乐
    initAudio() {
      audio.preload = 'auto'
      audio.loop = false
      audio.autoplay = false
      audio.volume = this.volume
      this.isPlay = false
      // 上次刷新时可能停留在拖动状态，这里复位，否则进度条会一直不更新
      this.isTouch = false
      this.isLoadingMusic = false
      switching = false

      // 恢复刷新前存下的进度（换过歌的话 id 对不上，会返回 0）
      playProgress.value = readPersistedProgress(this.currentMusicInfo?.id)

      if (this.currentMusic) {
        const total = this.currentMusic.duration || this.currentMusic.dt
        this.currentMusicInfo.duration = total ? Math.floor(total / 1000) : 0
      }

      // 节流函数
      const throttle = (func, limit) => {
        let lastFunc
        let lastRan
        return function () {
          const context = this
          const args = arguments
          if (!lastRan) {
            func.apply(context, args)
            lastRan = Date.now()
          } else {
            clearTimeout(lastFunc)
            lastFunc = setTimeout(
              () => {
                if (Date.now() - lastRan >= limit) {
                  func.apply(context, args)
                  lastRan = Date.now()
                }
              },
              limit - (Date.now() - lastRan)
            )
          }
        }
      }

      audio.ontimeupdate = throttle(() => {
        // duration 还没就绪时所有进度计算都无意义，直接跳过
        if (!Number.isFinite(audio.duration)) return

        // 更新音量（只有变化时才设置）
        if (Math.abs(audio.volume - this.volume) > 0.01) {
          audio.volume = this.volume
        }

        // 更新播放状态
        this.isPlay = !audio.paused

        // 拖动进度条期间不要用旧时间覆盖用户拖动的位置
        if (!this.isTouch) {
          // 写到 store 外面：这个值每 250ms 变一次，放 state 里会触发全量持久化，
          // 播放时的动画卡顿主要就是它引起的
          playProgress.value = audio.currentTime
        }

        // 更新总时长（优先用接口返回的时长，避免流式加载时 duration 为 Infinity）
        const total = this.currentMusic.duration || this.currentMusic.dt
        const totalSeconds = total ? Math.floor(total / 1000) : Math.floor(audio.duration)
        if (this.currentMusicInfo.duration !== totalSeconds) {
          this.currentMusicInfo.duration = totalSeconds
        }

        // 处理歌词索引
        this.syncLyricIndex(audio.currentTime)

        // 播放结束，处理下一首
        if (audio.ended && !switching) this.playNext(true, true)
      }, 100) // 节流时间间隔，单位毫秒
    },
    // 根据当前播放时间计算歌词索引（二分查找，前置条件：歌词已按时间升序）
    syncLyricIndex(currentTime) {
      const lyrics = this.currentMusicInfo.lyric
      // 歌词为空（接口失败/纯音乐）或没有时间轴时直接跳过，避免 "in undefined" 崩溃
      if (!Array.isArray(lyrics) || lyrics.length === 0) return
      if (lyrics[0]?.time == null) return

      let low = 0,
        high = lyrics.length - 1,
        mid
      while (low <= high) {
        mid = (low + high) >> 1
        if (lyrics[mid].time <= currentTime) low = mid + 1
        else high = mid - 1
      }
      // low - 1 为最后一句 time <= currentTime 的歌词；早于第一句时为 -1
      const index = low - 1
      if (this.currentMusicInfo.currentLyricIndex !== index) {
        this.currentMusicInfo.currentLyricIndex = index
      }
    },
    // 当前生效的歌曲列表
    getActivePlayList() {
      switch (this.playType) {
        case PLAYTYPE.FAVORITE:
          return this.favorite
        case PLAYTYPE.HOT:
          return this.playlistSongs
        case PLAYTYPE.ARTIST:
          return this.artistSongs
        case PLAYTYPE.DAILY:
          return this.dailySongs
        default:
          return this.playList
      }
    },
    // 上下首播放设置
    playNext(isPlayNext = false, fromEnded = false) {
      // 单曲循环 + 自然播放结束：直接重播，不再请求接口
      if (fromEnded && this.playMode === SINGLE_LOOP) {
        return this.replayCurrent()
      }
      const tempList = this.getActivePlayList()
      if (!tempList?.length) return this.replayCurrent()

      const nextIndex = getNextSong(tempList, this.playMode, isPlayNext, this.currentMusicInfo)
      if (nextIndex < 0 || !tempList[nextIndex]) return this.replayCurrent()
      // 记下方向：若目标歌曲也不可播，自动跳过要顺着同方向继续走，
      // 否则用户点上一首时会反而往前跳，体感像点错了按钮
      this.setMusicInfo(tempList[nextIndex], { skipForward: isPlayNext })
    },
    // 加入 / 取消我喜欢的音乐
    toggleFavorite(music) {
      if (!music?.id) return
      const index = this.favorite.findIndex(item => item?.id === music.id)
      if (index > -1) {
        this.favorite.splice(index, 1)
        normalBack('success', '已取消喜欢')
      } else {
        // 收藏时顺手把封面存下来：
        // 旧搜索接口（/search）只返回 album.picId、没有 picUrl，
        // 这里优先取歌曲自带的封面，其次用当前播放详情里的封面兜底，
        // 否则收藏列表会全是默认图。
        const cover =
          music.al?.picUrl ||
          music.album?.picUrl ||
          music.cover ||
          (music.id === this.currentMusicInfo.id ? this.currentMusicInfo.cover : '')
        // 放最前面，最近收藏的在列表顶部
        this.favorite.unshift({ ...music, cover: cover || '' })
        normalBack('success', '已加入我喜欢的音乐')
      }
    },
    /*
     * 批量补齐列表里缺失的封面。
     * 旧版搜索接口（/search）返回的 album 只有 picId、没有 picUrl，
     * 所以持久化下来的旧搜索列表、历史收藏都会缺封面。
     * 这里按 id 批量查 /song/detail 补一次，补到后写回对象本身（随 store 持久化），
     * 之后同一首歌不会再出现在 missing 里，也不会重复请求。
     */
    async fillMissingCovers(list) {
      if (!Array.isArray(list) || !list.length) return
      const missing = list.filter(
        item => item?.id && !(item.al?.picUrl || item.album?.picUrl || item.cover)
      )
      if (!missing.length) return
      try {
        // 接口对 ids 数量有上限，按 200 一批查
        for (let i = 0; i < missing.length; i += 200) {
          const chunk = missing.slice(i, i + 200)
          const songs = await getSongDetailBatch(chunk.map(item => item.id))
          const coverMap = new Map(songs.map(song => [song.id, song.al?.picUrl || '']))
          list.forEach(item => {
            const cover = coverMap.get(item?.id)
            if (cover && !item.cover) item.cover = cover
          })
        }
      } catch (error) {
        // 补封面是锦上添花，失败静默处理，不打断播放
      }
    },
    // 收藏页：补齐历史收藏的封面
    async ensureFavoriteCovers() {
      return this.fillMissingCovers(this.favorite)
    },
    // 重播当前歌曲（不重新拉地址）
    replayCurrent() {
      if (!audio.src) return this.setMusicInfo(this.currentMusic, { autoplay: true })
      audio.currentTime = 0
      this.isPlay = true
      this.isTouch = false
      audio.play().catch(() => {
        this.isPlay = false
        this.setMusicInfo(this.currentMusic, { autoplay: true })
      })
    },
    /*
     * 彻底停掉音源。
     * 只把 isPlay 置 false 是不够的：audio.src 上还挂着上一首，
     * 声音会继续放上一首，而封面 / 歌词 / 进度条已经换成这一首，出现音画错位。
     */
    stopAudio() {
      try {
        audio.pause()
      } catch (e) {
        // 音频还没挂音源时 pause 不抛错，这里只是兜底
      }
      // removeAttribute + load 才能真正释放旧音源；
      // 直接把 src 赋空字符串会让浏览器去请求当前页面地址
      if (audio.src) {
        audio.removeAttribute('src')
        try {
          audio.load()
        } catch (e) {
          // 个别浏览器在无音源时 load 会抛错，忽略即可
        }
      }
      this.isPlay = false
      this.isTouch = false
      this.currentMusicInfo.url = ''
      playProgress.value = 0
      this.currentMusicInfo.currentLyricIndex = -1
    },
    /*
     * 遇到不可播放的歌曲：先停播（避免上一首继续响），再顺着用户操作的方向自动跳过。
     * @param {boolean} skipForward true 往后跳（下一首 / 自然播放结束），false 往前跳（上一首）
     * @param {string} reason 不可播放的原因，用于提示
     */
    skipUnplayable(skipForward = true, reason = '') {
      this.stopAudio()
      const reasonText = reason || '该歌曲暂无可用播放地址'
      // 列表里没有别的歌可跳（只有这一首 / 列表为空）时，跳过去还是它，直接停下提示
      const others = (this.getActivePlayList() || []).filter(
        item => item?.id != this.currentMusicInfo.id
      )
      if (!others.length) {
        normalBack('warning', reasonText)
        return
      }
      if (autoSkipCount >= MAX_AUTO_SKIP) {
        autoSkipCount = 0
        normalBack('warning', `连续 ${MAX_AUTO_SKIP} 首歌曲无法播放，已停止自动跳过`)
        return
      }
      autoSkipCount++
      normalBack('warning', `${reasonText}，已自动跳过`)
      // 稍等一下再跳：让这首的封面 / 歌名先渲染出来，用户能看清跳过的是哪首
      const skipSeq = loadSeq
      setTimeout(() => {
        // 期间用户自己切了歌（loadSeq 变了）就不要再插手
        if (skipSeq !== loadSeq) return
        this.playNext(skipForward)
      }, 800)
    },
    // 统一构造当前播放信息，避免各处字段兜底逻辑不一致
    buildMusicInfo(music, { url = '', cover = '', lyric = [], comments = [] } = {}) {
      return {
        name: music.name,
        id: music.id,
        url,
        // 详情接口偶尔没有封面，退回列表里带的那份
        cover: cover || music.al?.picUrl || music.album?.picUrl || music.cover || '',
        lyric: Array.isArray(lyric) ? lyric : [],
        artists: music.artists || music.ar || [],
        album: music.album?.name || music.al?.name || '',
        currentLyricIndex: -1,
        currentTime: 0,
        duration: music.duration || music.dt ? Math.floor((music.duration || music.dt) / 1000) : 0,
        comments: Array.isArray(comments) ? comments : []
      }
    },
    // 获取歌曲信息 准备播放（后台加载，不再弹全屏遮罩）
    async setMusicInfo(music, { autoplay = true, resumeAt = 0, skipForward = true } = {}) {
      if (!music?.id) return

      // 每次切歌领取一个新序号，旧请求回来时 isStale() 为真，直接丢弃结果
      const seq = ++loadSeq
      const isStale = () => seq !== loadSeq
      switching = true
      this.isLoadingMusic = true

      try {
        /*
         * 地址和详情分开判定：
         * - 拿地址失败 = 接口 / 网络异常，自动跳过毫无意义（跳过去一样拉不到），只能停播提示；
         * - 详情失败只是少个封面 / 专辑名，不该把无版权误判成网络挂了。
         * 所以用 allSettled 而不是 all，避免一个失败把另一个的结果也丢掉。
         */
        const [urlRet, detailRet] = await Promise.allSettled([
          getSongUrl(music.id),
          getSongDetails(music.id)
        ])
        if (isStale()) return

        if (urlRet.status === 'rejected') {
          this.stopAudio()
          normalBack('warning', '获取歌曲信息失败,请检查网络或稍后再试')
          return
        }
        const songUrl = urlRet.value
        const details = detailRet.status === 'fulfilled' ? detailRet.value || [] : []

        // 无版权 / 已下架：拿不到地址，歌词和评论也没必要再请求，直接走跳过流程。
        // 注意先把这首歌写进 currentMusicInfo —— 自动跳过要靠它的 id 算索引，
        // 停在上一首的 id 上会从上一首重新推算，导致原地打转。
        if (!songUrl?.url) {
          this.currentMusic = music
          this.currentMusicInfo = this.buildMusicInfo(music, { cover: details?.[0]?.al?.picUrl })
          this.skipUnplayable(skipForward, `《${music.name}》暂无版权或播放地址`)
          return
        }

        let lyricList = []
        let comments = []
        try {
          const lyricRes = await getSongLyric(music.id)
          // 官方翻译按时间戳对齐到原词，挂到每行的 tword 字段上
          lyricList = withTranslation(lyricRes?.lyric || [], lyricRes?.tlyric || [])
        } catch (e) {
          lyricList = []
        }
        try {
          comments = await getSongComment(music.id)
        } catch (e) {
          comments = []
        }
        if (isStale()) return

        this.currentMusic = music
        this.currentMusicInfo = this.buildMusicInfo(music, {
          url: songUrl.url,
          cover: details?.[0]?.al?.picUrl,
          lyric: lyricList,
          comments
        })

        const started = await this.loadAndPlay(songUrl.url, autoplay, resumeAt, seq, skipForward)
        if (isStale()) return
        if (!started) {
          // 地址有了但音频本身加载不出来（已重试过一次）：同样跳过，别卡死在这一首
          this.skipUnplayable(skipForward, `《${music.name}》音频加载失败`)
          return
        }
        if (!autoplay) return
        // 加载成功后在页面顶部轻提示一下（ElMessage），不阻塞任何操作
        normalBack('success', `正在播放：${music.name}`)
      } catch (error) {
        if (isStale()) return
        // 接口异常时同样要让界面认住这首歌并清掉旧音源，否则会停在上一位的音画错位状态
        this.currentMusic = music
        this.currentMusicInfo = this.buildMusicInfo(music)
        this.skipUnplayable(skipForward, `《${music.name}》播放失败`)
      } finally {
        // 只有最新那次请求负责收尾，避免旧请求提前解锁 / 清掉加载态
        if (!isStale()) {
          this.isLoadingMusic = false
          switching = false
        }
      }
    },
    // 加载音频并播放；resumeAt > 0 时从指定位置续播；返回是否真正加载成功
    async loadAndPlay(url, autoplay = true, resumeAt = 0, seq = loadSeq, skipForward = true) {
      const isStale = () => seq !== loadSeq
      if (isStale()) return false

      // 摘掉上一次的续播监听，防止它作用到新歌上
      if (pendingSeek) {
        audio.removeEventListener('loadedmetadata', pendingSeek)
        pendingSeek = null
      }

      if (!url) {
        // 正常流程已在 setMusicInfo 里拦掉，这里只是兜底：
        // 必须清掉旧音源，否则上一首会继续播放，和新歌的封面歌词对不上
        this.stopAudio()
        return false
      }
      this.currentMusicInfo.url = url
      audio.src = url

      if (resumeAt > 0) {
        // 必须在元数据就绪后再设置 currentTime，否则会被浏览器忽略
        pendingSeek = () => {
          audio.currentTime = Math.min(resumeAt, audio.duration || resumeAt)
          pendingSeek = null
        }
        audio.addEventListener('loadedmetadata', pendingSeek, { once: true })
      }

      if (!autoplay) {
        this.isPlay = false
        return true
      }

      try {
        await audio.play()
        // 播放期间用户又切了歌，这次结果作废（不写 isPlay、不弹消息）
        if (isStale()) return false
        this.isPlay = true
        // 新歌真正开始播放时清掉可能卡住的拖动标记：
        // 若上一首结束时用户正好在拖进度条，song 切换会中断 el-slider 使其不再发 @change，
        // 导致 isTouch 永久卡在 true，之后所有 timeupdate 都跳过进度写入（进度条不动但歌照常播）
        this.isTouch = false
        lastFailedUrl = ''
        // 真的播出声音了，说明列表里还有能放的歌，重置连续跳过计数
        autoSkipCount = 0
        return true
      } catch (error) {
        // 换 src 会让上一次 play() 主动 reject，这种不是真的失败，直接忽略
        if (isStale()) return false
        this.isPlay = false
        // 同一个地址只重试一次，避免失败 -> 重新拉地址 -> 再次失败的无限循环
        if (lastFailedUrl === url) {
          normalBack('warning', '音频加载失败，请切换歌曲后重试')
          return false
        }
        lastFailedUrl = url
        // 重试会领取新的请求序号，本次直接作废，由重试那次负责提示；
        // skipForward 要一起带过去，否则重试失败后自动跳过会丢掉方向
        return this.setMusicInfo(this.currentMusic, {
          autoplay,
          resumeAt: playProgress.value,
          skipForward
        })
      }
    },
    // 重置搜索设置
    resetSearch() {
      this.searchSettings.searchOffset = 0
      this.searchSettings.isSearchOverCounts = false
    },
    // 搜索歌曲设置
    async setMusicList(keywords) {
      // 判断关键字输入状态
      if (!keywords || !String(keywords).trim()) return normalBack('warning', '请输入搜索内容')
      // 重置搜索设置
      this.resetSearch()
      try {
        this.keywords = String(keywords).trim()
        const res = await this.getSearchPlayListSafe()
        this.playList = res.songs || []
      } catch (error) {
        this.playList = []
        normalBack('warning', error.message)
      } finally {
        // 新搜索（无论成功失败）都通知列表页回到顶部；
        // 触底加载走的是 loadMore，不会改这个值，所以不会误复位
        this.searchVersion++
      }
    },
    // 搜索列表触底加载
    async loadMore() {
      const settings = this.searchSettings
      if (settings.isSearchOverCounts) return
      try {
        const nextOffset = settings.searchOffset + settings.searchLimit
        const res = await this.getSearchPlayListSafe(nextOffset)
        const songs = res.songs || []
        if (!songs.length || res.songCount <= nextOffset) {
          settings.isSearchOverCounts = true
          return
        }
        settings.searchOffset = nextOffset
        this.playList = [...this.playList, ...songs]
      } catch (error) {
        normalBack('warning', error.message)
      }
    },
    // 封装搜索调用
    async getSearchPlayListSafe(offset = this.searchSettings.searchOffset) {
      return await getMusicList(this.keywords, this.searchSettings.searchLimit, offset)
    },
    // 封装歌单歌曲调用
    async getPlaylistSongsSafe(id, offset = this.searchSettings.playlistOffset) {
      return await getPlaylistSongs(id, this.searchSettings.playlistLimit, offset)
    },
    // 播放控制
    async togglePlay() {
      if (this.isPlay) {
        audio.pause()
        this.isPlay = false
        // 暂停时把位置记下来，下次接着听
        persistProgress(this.currentMusicInfo.id, playProgress.value)
        return
      }
      if (!this.currentMusicInfo.url) {
        // 有歌名说明是这首歌不可播，没歌名就是还没点过任何歌曲
        return normalBack(
          'info',
          this.currentMusicInfo.name ? '这首歌暂无可用播放地址' : '暂无歌曲'
        )
      }
      // 浏览器里还挂着有效音源时直接恢复，避免重新拉流
      if (audio.src && audio.paused) {
        // 播放结束后再点播放，要回到开头，否则会立刻再次触发结束
        if (audio.ended) audio.currentTime = 0
        try {
          await audio.play()
          this.isPlay = true
          this.isTouch = false
          return
        } catch (e) {
          // 地址可能已过期，落到下面重新拉
        }
      }
      return this.setMusicInfo(this.currentMusic, {
        autoplay: true,
        resumeAt: playProgress.value
      })
    },
    // 音量控制
    setVolume(value) {
      this.volume = value
      audio.volume = value
    },
    // 音量控制 关闭
    stepCloseVolume() {
      closeBeforeVolume.value = this.volume || 0.5
      this.setVolume(0)
    },
    // 音量控制 打开
    stepOpenVolume() {
      this.setVolume(closeBeforeVolume.value || 0.5)
    },
    // 点击歌词跳转
    skipByLyric(time) {
      // 纯文本歌词的 time 为 null，点击不应该跳到 0
      if (time == null || !Number.isFinite(time)) return
      audio.currentTime = time
      playProgress.value = time
      this.syncLyricIndex(time)
    },
    /*
     * 拖动中只更新预览时间，不会更新audio.currentTime。
     * pointerdown / 全局 pointerup），否则 el-slider 在切歌时因 :max / :model-value 变化自行触发
     * 的 @input 会被误判成用户开始拖动，而这次 emit 没有配套的 @change，isTouch 就会永久卡在
     * true，之后所有 timeupdate 都跳过进度写入，进度条冻结但歌照常播。
     */
    setProgress(time) {
      const value = Number(time)
      if (Number.isFinite(value)) {
        playProgress.value = Math.max(0, value)
      }
    },
    // 仅在真实指针按下/抬起时维护拖动标记，彻底绕开 el-slider 的 @input 误报
    setDragging(val) {
      this.isTouch = Boolean(val)
    },
    // 拖动结束：松手才真正 seek，避免边拖边跳造成音频断续
    setProgressDone(time) {
      const value = Number(time)
      const target = Number.isFinite(value)
        ? Math.max(0, value)
        : Math.max(0, Number(playProgress.value) || 0)

      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        // 接口给的时长是整秒，真实音频可能略长/略短，seek 时钳到实际范围
        audio.currentTime = Math.min(target, audio.duration)
        playProgress.value = audio.currentTime
        this.syncLyricIndex(audio.currentTime)
      } else {
        audio.currentTime = 0
        playProgress.value = 0
      }
      this.isTouch = false
    },
    // 推荐歌单（热门歌单页）
    async setRecommendedPlayLists() {
      try {
        this.recommendedPlayLists = await getPersonalizedPlaylists(30)
      } catch (error) {
        this.recommendedPlayLists = []
        normalBack('warning', error.message)
      }
    },
    // 每日推荐（发现音乐页）
    async setDailySongs() {
      try {
        this.dailySongs = await getDailySongs()
        // 记下这份推荐属于哪一天，第二天进来才能判断该不该重拉
        this.dailySongsDate = todayKey()
      } catch (error) {
        this.dailySongs = []
        normalBack('warning', error.message)
      }
    },
    /*
     * 日推是否需要重新拉取：
     * 没数据，或者上次拿到的是「今天以前」的数据。
     * 用日期比较而不是定时器 —— 用户关掉页面再打开也能正确刷新，
     * 而且不需要在页面里挂一个跨夜的 setTimeout。
     */
    needRefreshDaily() {
      return !this.dailySongs.length || this.dailySongsDate !== todayKey()
    },
    // 歌单详情：元信息 + 第一页歌曲
    async setPlaylistDetail(id) {
      if (!id) return normalBack('warning', '歌单不存在')
      const settings = this.searchSettings
      settings.playlistOffset = 0
      settings.isPlaylistOverCounts = false
      // 先清空，避免切换歌单时短暂显示上一个歌单的歌曲
      this.playlistSongs = []
      this.playlistInfo = {
        id,
        name: '',
        cover: '',
        creator: '',
        tags: [],
        trackCount: 0,
        playCount: 0,
        description: ''
      }
      // 元信息和歌曲互不依赖，并发请求；任一失败不影响另一个
      const [info, songRes] = await Promise.all([
        getPlaylistInfo(id).catch(() => null),
        this.getPlaylistSongsSafe(id, 0).catch(() => null)
      ])
      this.playlistInfo = info
        ? {
            id,
            name: info.name || '',
            cover: info.coverImgUrl || '',
            creator: info.creator?.nickname || '',
            tags: Array.isArray(info.tags) ? info.tags : [],
            trackCount: Number(info.trackCount) || 0,
            playCount: Number(info.playCount) || 0,
            description: info.description || ''
          }
        : {
            id,
            name: '',
            cover: '',
            creator: '',
            tags: [],
            trackCount: 0,
            playCount: 0,
            description: ''
          }

      if (!songRes) {
        this.playlistSongs = []
        settings.isPlaylistOverCounts = true
        return normalBack('warning', '获取歌单歌曲失败')
      }
      const songs = songRes.songs || []
      this.playlistSongs = songs
      settings.playlistOffset = songs.length
      // 不满一页说明没有下一页
      if (songs.length < settings.playlistLimit) settings.isPlaylistOverCounts = true
    },
    // 歌单歌曲触底加载
    async loadMorePlaylist() {
      const settings = this.searchSettings
      if (settings.isPlaylistOverCounts) return
      if (!this.playlistInfo.id) return
      // 当前页没满，说明后面没有了
      if (this.playlistSongs.length < settings.playlistLimit) return
      try {
        const res = await this.getPlaylistSongsSafe(this.playlistInfo.id, settings.playlistOffset)
        const songs = res.songs || []
        if (!songs.length) {
          settings.isPlaylistOverCounts = true
          return
        }
        settings.playlistOffset += songs.length
        this.playlistSongs = [...this.playlistSongs, ...songs]
        if (songs.length < settings.playlistLimit) settings.isPlaylistOverCounts = true
      } catch (error) {
        normalBack('warning', error.message)
      }
    },
    // 歌手热门歌曲：重置分页并加载第一页
    async setArtistSongs(artist) {
      const id = artist?.id
      if (!id) return normalBack('warning', '暂无法获取该歌手信息')
      const settings = this.searchSettings
      settings.artistOffset = 0
      settings.isArtistOverCounts = false
      this.artistInfo = { id, name: artist.name || '' }
      try {
        const res = await this.getArtistSongsSafe(id, 0)
        const songs = res.songs || []
        this.artistSongs = songs
        settings.artistOffset = songs.length
        // 没有下一页（空列表 / 不满一页 / more=false）就直接标记到底
        if (!res.more || !songs.length) settings.isArtistOverCounts = true
      } catch (error) {
        this.artistSongs = []
        normalBack('warning', error.message)
      }
    },
    // 歌手热门歌曲：触底加载下一页
    async loadMoreArtist() {
      const settings = this.searchSettings
      if (settings.isArtistOverCounts) return
      if (!this.artistInfo.id) return
      // 当前页没满，说明后面没有了
      if (this.artistSongs.length < settings.artistLimit) return
      try {
        const res = await this.getArtistSongsSafe(this.artistInfo.id, settings.artistOffset)
        const songs = res.songs || []
        if (!songs.length) {
          settings.isArtistOverCounts = true
          return
        }
        // 请求成功后再推进偏移量，失败不会跳页
        settings.artistOffset += songs.length
        this.artistSongs = [...this.artistSongs, ...songs]
        if (!res.more) settings.isArtistOverCounts = true
      } catch (error) {
        normalBack('warning', error.message)
      }
    },
    // 封装歌手歌曲调用
    async getArtistSongsSafe(id, offset = this.searchSettings.artistOffset) {
      return await getArtistSongs(id, this.searchSettings.artistLimit, offset)
    }
  },
  // 持久化存储
  persist: {
    storage: debouncedLocalStorage,
    key: 'music-player',
    /*
     * 只存需要跨刷新保留的字段。
     * 歌单歌曲、歌手歌曲这类大列表刷新后会重新请求，存着只会拖慢每次序列化；
     * 播放进度在 utils/playProgress 里，本来就不在这里。
     */
    paths: [
      'volume',
      'playType',
      'playMode',
      'currentMusic',
      'favorite',
      'playList',
      'keywords',
      'dailySongs',
      'dailySongsDate',
      'isShowScrollLyrics',
      'isShowAnimationLyrics',
      'currentMusicInfo',
      'searchSettings'
    ]
  }
})
