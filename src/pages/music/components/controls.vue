<script setup>
import { musicStatus } from '@/store';
import { storeToRefs } from 'pinia';
import { timeFormat, PLAYMODEL, PLAYTYPE } from '@/utils/music';
import { computed, defineOptions, onMounted, onUnmounted, ref, watch } from 'vue';
import defaultCover from '@/assets/image/109951173012411790.jpg';
import { useCanHover } from '@/composables/useResponsive';
import { normalBack } from '@/utils/MessageBack';
import ArtistLinks from './artistLinks.vue';

defineOptions({
  name: 'MusicControl'
})

const store = musicStatus()
const { getIsplay, volume, currentMusicInfo, playMode, isTouch, currentMusic, playType } = storeToRefs(store)

defineProps({
  toggleLyricBoard: Function
})

const smallMusicCover = computed(() => {
  return currentMusicInfo.value.cover || defaultCover
})

/*
 * 进度条上方的「当前时间 / 总时长」气泡
 * - 拖动时一定显示（isTouch 由 store 在 setProgress / setProgressDone 里维护）
 * - 桌面端鼠标悬浮到进度条上时也显示；手机/平板（无 hover 能力）不启用
 * - 位置始终按播放进度百分比走，两端用 clamp 留出半个标签宽度，避免贴边被裁掉
 */
const isDragging = computed(() => Boolean(isTouch.value))
const canHover = useCanHover()
const isHovering = ref(false)

const showTimeTip = computed(() => {
  // 没有歌曲时气泡会显示 00:00 / 00:00，纯噪音，直接不显示
  const hasTrack = Number(currentMusicInfo.value.duration) > 0
  return hasTrack && (isDragging.value || (canHover.value && isHovering.value))
})

const handleProgressEnter = () => {
  // 触屏设备不跟踪悬浮，避免点击后 hover 粘住
  if (canHover.value) isHovering.value = true
}
const handleProgressLeave = () => {
  isHovering.value = false
}

// 设备从「有鼠标」切到触屏（如拔掉扩展坞）时，清掉悬浮态
watch(canHover, value => {
  if (!value) isHovering.value = false
})

// 滑块用「秒」而不是百分比：max = 歌曲总时长，step = 1 秒
const sliderMax = computed(() => {
  const duration = Number(currentMusicInfo.value.duration)
  return Number.isFinite(duration) && duration > 0 ? duration : 1
})

const dragTipStyle = computed(() => {
  const duration = Number(currentMusicInfo.value.duration) || 0
  const time = Number(currentMusicInfo.value.currentTime) || 0
  // 位置仍按百分比渲染，但由「秒 / 总秒数」现算，不再依赖单独的百分比字段
  const percent = duration > 0 ? (time / duration) * 100 : 0
  const clamped = Math.min(100, Math.max(0, percent))
  // 3.1rem ≈ 半个气泡宽 + 6px，保证贴边时气泡边缘不顶到面板边框
  return { left: `clamp(3.1rem, ${clamped}%, calc(100% - 3.1rem))` }
})

/*
 * 拖动中只更新预览时间，松手才 seek。
 * 不用 v-model 直接写 store，是为了保证 isTouch 一定先于时间写入，
 * 否则高频 timeupdate 可能把拖动的位置覆盖掉。
 */
const onProgressInput = (time) => {
  store.setProgress(time)
}
const onProgressChange = (time) => {
  store.setProgressDone(time)
}
/*
 * 拖动标记改用真实指针事件维护，而不是依赖 el-slider 的 @input：
 * el-slider 在切歌时因 :max / :model-value 变化会自行 emit @input，若用它来置 isTouch=true，
 * 没有配套的 @change 收尾就会把标记永久卡住，导致进度条冻结。
 * 用 capture 是因为 el-slider 可能在内部 stopPropagation，捕获阶段能确保先拿到事件。
 */
const onProgressPointerDown = () => store.setDragging(true)
const onProgressPointerUp = () => store.setDragging(false)

// 歌手名兜底放在计算属性里，模板里的 "/" + name || '暂无歌手' 因为字符串恒为真而永远不生效
const artistsText = computed(() => {
  const artists = currentMusicInfo.value.artists
  if (!Array.isArray(artists) || artists.length === 0) return '暂无歌手'
  return artists.map(item => item?.name).filter(Boolean).join(' / ')
})

const onVolumeChange = (value) => {
  // audio.volume 只接受 0~1，超范围浏览器会抛 DOMException，这里统一收口
  const v = Number(value)
  // 直接同步到 audio.volume，避免暂停时拖音量要等到下一次 timeupdate 才生效
  store.setVolume(Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)
}

/* ---------------- 控制栏弹层（音量 / 播放列表，互斥） ---------------- */
const controlBarRef = ref(null)
const activePanel = ref('') // '' | 'volume' | 'playlist'

const togglePanel = (name) => {
  activePanel.value = activePanel.value === name ? '' : name
}
const closePanel = () => {
  activePanel.value = ''
}
const onDocPointerDown = (event) => {
  // 点到控制栏以外就收起；弹层本身在控制栏内部，不会误关
  if (!controlBarRef.value?.contains(event.target)) closePanel()
}
const onKeydown = (event) => {
  if (event.key === 'Escape') closePanel()
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onKeydown)
  // 全局抬手清掉拖动标记：即使拖动被切歌打断、el-slider 没发 @change，这里也能兜底复位
  window.addEventListener('pointerup', onProgressPointerUp)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointerup', onProgressPointerUp)
})

/* ---------------- 圆形音量旋钮（沿圆周旋转拖动） ---------------- */
const knobRef = ref(null)
const KNOB_RADIUS = 40
const KNOB_CIRC = 2 * Math.PI * KNOB_RADIUS      // 整圆周长 ≈ 251.3
const KNOB_ARC = KNOB_CIRC * 0.75                 // 只画 270° 的弧 ≈ 188.5
const START_DEG = 135                             // 弧从左下开始（SVG 角度，顺时针）
const SWEEP_DEG = 270

const currentVolume = computed(() => {
  const v = Number(volume.value)
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
})
const volumePercent = computed(() => Math.round(currentVolume.value * 100))
const knobDash = computed(() => `${currentVolume.value * KNOB_ARC} ${KNOB_CIRC}`)

/**
 * 把鼠标相对圆心的角度换算成音量
 * 有效区间是 135° → 405°（顺时针 270°）；底部 45°~135° 是不画弧的死区，
 * 按离哪一端更近钳到 0 或 1，避免拖过底部时数值乱跳。
 */
const angleToVolume = (deg) => {
  const d = ((deg % 360) + 360) % 360
  let pos
  if (d < 45) pos = d + 360
  else if (d <= 135) pos = (d - 45) < (135 - d) ? 405 : 135
  else pos = d
  return Math.min(1, Math.max(0, (pos - START_DEG) / SWEEP_DEG))
}

let knobDragging = false
const updateVolumeFromPointer = (event) => {
  const el = knobRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const deg = Math.atan2(
    event.clientY - (rect.top + rect.height / 2),
    event.clientX - (rect.left + rect.width / 2)
  ) * 180 / Math.PI
  onVolumeChange(Math.round(angleToVolume(deg) * 100) / 100)
}
const onKnobDown = (event) => {
  knobDragging = true
  event.currentTarget.setPointerCapture?.(event.pointerId)
  updateVolumeFromPointer(event)
}
const onKnobMove = (event) => {
  if (knobDragging) updateVolumeFromPointer(event)
}
const onKnobUp = () => {
  knobDragging = false
}
const onKnobWheel = (event) => {
  const delta = event.deltaY > 0 ? -0.05 : 0.05
  onVolumeChange(Math.round((currentVolume.value + delta) * 100) / 100)
}
const toggleMute = () => {
  if (currentVolume.value > 0) store.stepCloseVolume()
  else store.stepOpenVolume()
}

/* ---------------- 当前播放列表 ---------------- */
const activePlayList = computed(() => store.getActivePlayList() || [])
const activeListName = computed(() => ({
  [PLAYTYPE.SEARCH]: '搜索列表',
  [PLAYTYPE.FAVORITE]: '我喜欢的音乐',
  [PLAYTYPE.HOT]: '歌单',
  [PLAYTYPE.ARTIST]: '歌手热门',
  [PLAYTYPE.DAILY]: '每日推荐'
}[playType.value] || '播放列表'))

const formatRowArtists = (row) => {
  const artists = row?.artists || row?.ar || []
  return Array.isArray(artists) ? artists.map(item => item?.name).filter(Boolean).join(' / ') : ''
}
const playFromList = (row) => {
  // playType 不变，所以上下首仍在这个列表里轮转
  store.setMusicInfo(row)
  closePanel()
}

// 当前播放歌曲是否已收藏（控制栏的小爱心）
const isCurrentFavorite = computed(() => {
  const id = currentMusic.value?.id || currentMusicInfo.value?.id
  return id ? musicStatus().isFavorite(id) : false
})

const toggleCurrentFavorite = () => {
  if (!currentMusic.value?.id) return normalBack('info', '还没有正在播放的歌曲')
  musicStatus().toggleFavorite(currentMusic.value)
}
</script>

<template>
  <!-- 歌曲图片信息 -->
  <div class="flex justify-evenly items-center max-md:w-[40%] w-[30%]">
    <!-- 图片 -->
    <div class="relative overflow-hidden left-1 rounded-2xl border-[1px] border-gray-500 w-[4rem] h-[4rem]"
      @click="toggleLyricBoard">
      <img class="object-cover cursor-pointer w-full h-auto hover:scale-125 duration-300" :src="smallMusicCover"
        alt="歌曲封面">
    </div>
    <!-- 歌曲歌手 -->
    <div class="relative w-[55%] max-md:left-[8px] left-1 max-md:text-[0.8rem] text-[#ffffff]">
      <div class="text-ellipsis whitespace-nowrap overflow-x-hidden" :title="currentMusicInfo.name">
        <span>{{ currentMusicInfo.name || '暂无歌曲' }}</span>
      </div>
      <div class="text-ellipsis whitespace-nowrap overflow-x-hidden" :title="artistsText">
        <ArtistLinks :artists="currentMusicInfo.artists" />
      </div>
    </div>
  </div>
  <div id="audioSchedule" class="absolute w-full overflow-visible flex items-center"
    @pointerdown.capture="onProgressPointerDown" @mouseenter="handleProgressEnter" @mouseleave="handleProgressLeave">
    <!-- 拖动 / 桌面端悬浮时，跟随进度显示当前时间与总时长 -->
    <Transition name="drag-tip">
      <div v-show="showTimeTip" class="drag-time" :style="dragTipStyle" aria-hidden="true">
        <span class="drag-time__current">{{ timeFormat(currentMusicInfo.currentTime) }}</span>
        <span class="drag-time__sep">/</span>
        <span class="drag-time__total">{{ timeFormat(currentMusicInfo.duration) }}</span>
      </div>
    </Transition>
    <el-slider class="absolute w-[98%] left-[1%]" :model-value="currentMusicInfo.currentTime" :max="sliderMax" :step="1"
      size="small" :show-tooltip="false" @input="onProgressInput" @change="onProgressChange" />
  </div>
  <!-- 控制栏 -->
  <div ref="controlBarRef" class="flex justify-around flex-col w-[60%] min-w-[60%]">
    <!-- 播放顺序 / 音量 / 播放列表 -->
    <div class="flex justify-center">
      <div class="flex items-center relative">
        <!-- 收藏当前歌曲：放在播放模式左边 -->
        <i class="iconfont" :class="isCurrentFavorite ? 'icon-aixin1-copy is-favorite' : 'icon-aixin'"
          :title="isCurrentFavorite ? '取消喜欢' : '加入我喜欢的音乐'" @click="toggleCurrentFavorite"></i>
        <i class="iconfont icon-suijibofang" v-show="playMode == PLAYMODEL[1]" @click="playMode = PLAYMODEL[0]"
          title="随机播放"> </i>
        <i class="iconfont icon-danquxunhuan" v-show="playMode == PLAYMODEL[2]" @click="playMode = PLAYMODEL[1]"
          title="单曲循环"> </i>
        <i class="iconfont icon-liebiaoxunhuan" v-show="playMode == PLAYMODEL[0]" @click="playMode = PLAYMODEL[2]"
          title="列表循环"> </i>
        <i class="iconfont icon-zuobofang" @click="musicStatus().playNext()" title="上一首"> </i>
        <i class="iconfont icon-zanting" @click="musicStatus().togglePlay()" v-show="getIsplay" title="暂停"></i>
        <i class="iconfont icon-bofang" @click="musicStatus().togglePlay()" v-show="!getIsplay" title="播放"></i>
        <i class="iconfont icon-youbofang" @click="musicStatus().playNext(true)" title="下一首"> </i>
      </div>

      <!-- 音量：圆形旋钮，点在图标上方弹出；窄屏隐藏，手机用系统音量键 -->
      <div class="ctl-pop-anchor volume-anchor">
        <i class="iconfont" :class="currentVolume > 0 ? 'icon-yinliang' : 'icon-shengyin-jingyin'"
          :title="`音量 ${volumePercent}%`" @click="togglePanel('volume')"></i>
        <Transition name="pop">
          <div v-if="activePanel === 'volume'" class="volume-pop">
            <div ref="knobRef" class="volume-knob" @pointerdown="onKnobDown" @pointermove="onKnobMove"
              @pointerup="onKnobUp" @pointercancel="onKnobUp" @wheel.prevent="onKnobWheel">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle class="knob-track" cx="50" cy="50" :r="KNOB_RADIUS" transform="rotate(135 50 50)" />
                <circle class="knob-value" cx="50" cy="50" :r="KNOB_RADIUS" :stroke-dasharray="knobDash"
                  transform="rotate(135 50 50)" />
              </svg>
              <button class="knob-center" title="静音 / 恢复" @pointerdown.stop @click.stop="toggleMute">
                {{ volumePercent }}%
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- 当前播放列表：标明列表来源，点一行即切歌 -->
      <div class="ctl-pop-anchor">
        <i class="iconfont icon-bofangliebiao" :title="`播放列表：${activeListName}`" @click="togglePanel('playlist')"></i>
        <Transition name="pop">
          <div v-if="activePanel === 'playlist'" class="playlist-pop">
            <div class="playlist-head">
              <span>{{ activeListName }}</span>
              <span class="playlist-count">{{ activePlayList.length }} 首</span>
            </div>
            <div v-if="!activePlayList.length" class="playlist-empty">列表里还没有歌曲</div>
            <ul v-else class="playlist-items">
              <li v-for="row in activePlayList" :key="row.id" :class="{ 'is-current': row.id === currentMusicInfo.id }"
                @click="playFromList(row)">
                <span class="pl-name" :title="row.name">{{ row.name }}</span>
                <span class="pl-artist" :title="formatRowArtists(row)">{{ formatRowArtists(row) }}</span>
              </li>
            </ul>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.iconfont {
  @apply text-xl text-[#ffffff] h-6 hover:scale-110 active:scale-50 duration-300 ease-in-out cursor-pointer mx-[0.4rem]
}

/* .iconfont:active {
  @apply scale-[1.1]
} */

/* 已收藏的爱心：红色实心，和未收藏的白色描边区分开 */
.iconfont.is-favorite {
  color: #ff6b81;
}

/* ---------------- 控制栏弹出面板 ---------------- */
.ctl-pop-anchor {
  position: relative;
  z-index: 45;
  display: flex;
  align-items: center;
}

.volume-pop,
.playlist-pop {
  position: absolute;
  bottom: calc(100% + 0.55rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 45;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0.8rem;
  background: rgba(20, 20, 40, 0.94);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
}

/* 只做透明度过渡：两个面板的定位 transform 不同，共用 transform 动画会打架 */
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.18s ease;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
}

/* 圆形音量旋钮 */
.volume-pop {
  padding: 0.5rem;
}

.volume-knob {
  position: relative;
  width: 5.5rem;
  height: 5.5rem;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.volume-knob:active {
  cursor: grabbing;
}

.volume-knob svg {
  display: block;
  width: 100%;
  height: 100%;
}

.knob-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.16);
  stroke-width: 8;
  stroke-linecap: round;
  /* 只画 270° 的弧（r=40，整圆 251.33，270° = 188.5） */
  stroke-dasharray: 188.5 251.33;
}

.knob-value {
  fill: none;
  stroke: #6699ff;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dasharray 0.08s linear;
}

.knob-center {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 9999px;
  background: transparent;
  color: #ffffff;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  transition: background 0.18s ease;
}

.knob-center:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 当前播放列表 */
.playlist-pop {
  display: flex;
  flex-direction: column;
  width: 16rem;
  max-height: 18rem;
  overflow: hidden;
}

.playlist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 0.8rem;
  color: #ffffff;
}

.playlist-count {
  color: rgba(255, 255, 255, 0.5);
}

.playlist-items {
  margin: 0;
  padding: 0.3rem;
  list-style: none;
  overflow-y: auto;
}

.playlist-items li {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.35rem 0.5rem;
  border-radius: 0.35rem;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.75rem;
  transition: background 0.15s ease;
}

.playlist-items li:hover {
  background: rgba(255, 255, 255, 0.12);
}

.playlist-items li.is-current {
  color: #99ccff;
  background: rgba(102, 153, 255, 0.16);
}

.pl-name,
.pl-artist {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pl-artist {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.45);
}

.playlist-empty {
  padding: 1.2rem;
  text-align: center;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.45);
}

/* 与 max-md 断点对齐：640~767px 也按窄屏处理 */
@media (max-width: 767.98px) {

  /* 手机用系统音量键；写在 scoped 里才能压过 .ctl-pop-anchor 的 display:flex */
  .ctl-pop-anchor.volume-anchor {
    display: none;
  }

  /* 多了播放列表图标，窄屏收紧间距 */
  .iconfont {
    margin-left: 0.15rem;
    margin-right: 0.15rem;
  }

  .playlist-pop {
    width: 13rem;
    max-height: 14rem;
    /* 窄屏靠右对齐，避免面板被屏幕左边界裁掉 */
    left: auto;
    right: -0.5rem;
    transform: none;
  }
}

/* 进度条：透明轨道 + 蓝色进度 */
:deep(#audioSchedule .el-slider__runway) {
  background: transparent;
}

:deep(.el-slider__bar) {
  background: #6699FF;
}

:deep(.el-slider__button) {
  width: 6px;
  height: 6px;
  border: 0;
  background: #0099FF;
}

:deep(.el-slider):hover .el-slider__button {
  width: 10px;
  height: 10px;
  background: #0099FF;
}

:deep(.el-progress--line) {
  width: 100%;
}

/* 拖动进度条时跟随显示的时间气泡 */
.drag-time {
  position: absolute;
  bottom: 0.75rem;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  background: rgba(18, 18, 38, 0.86);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  color: #ffffff;
  font-size: 0.75rem;
  line-height: 1.25;
  white-space: nowrap;
  pointer-events: none;
  z-index: 30;
  /* 数字等宽，拖动时不会因字形变化而左右抖动 */
  font-variant-numeric: tabular-nums;
}

.drag-time__current {
  color: #99ccff;
  font-weight: 600;
}

.drag-time__sep {
  color: rgba(255, 255, 255, 0.45);
}

.drag-time__total {
  color: rgba(255, 255, 255, 0.75);
}

.drag-tip-enter-active,
.drag-tip-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.drag-tip-enter-from,
.drag-tip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

/* 窄屏字体再小一点，避免气泡过宽 */
@media (max-width: 639.98px) {
  .drag-time {
    font-size: 0.7rem;
    padding: 0.1rem 0.45rem;
  }
}
</style>
