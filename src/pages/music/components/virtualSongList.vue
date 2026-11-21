<script setup>
/* 虚拟列表：只渲染可视区域，几百行也不卡 */
import { computed, onActivated, onDeactivated, onMounted, watch } from 'vue'
import { useMediaQuery, useVirtualList, useInfiniteScroll } from '@vueuse/core'
import { timeFormat } from '@/utils/music'
import { musicStatus } from '@/store'
import { saveScroll, takeScroll } from '@/composables/useScrollMemory'
import SongCell from './songCell.vue'
import ArtistLinks from './artistLinks.vue'

defineOptions({
  name: 'VirtualSongList'
})

const props = defineProps({
  songs: { type: Array, default: () => [] },
  currentId: { type: [String, Number], default: '' },
  loading: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: true },
  // 传了才启用「按 key 记忆滚动位置」。不传的页面（搜索/喜欢/每日/歌手）维持原来的组件内 savedTop 逻辑。
  scrollMemoryKey: { type: String, default: '' }
})

const emit = defineEmits(['row-click', 'favorite-toggle', 'load-more'])

const store = musicStatus()
const isMobile = useMediaQuery('(max-width: 767.98px)')

// 行高必须和 CSS 里的 .vlist-row 高度一致，否则滚动位置会错
const rowHeight = computed(() => (isMobile.value ? 52 : 60))
const coverSize = computed(() => (isMobile.value ? 30 : 38))

const { list, containerProps, wrapperProps } = useVirtualList(
  computed(() => props.songs),
  { itemHeight: () => rowHeight.value, overscan: 8 }
)

// 复用虚拟列表的滚动容器做触底加载
useInfiniteScroll(containerProps.ref, () => emit('load-more'), {
  distance: 200,
  // 没有数据时不触发：空容器永远被判定在底部，会误判成「已经到底」
  canLoad: () => props.songs.length > 0 && props.hasMore && !props.loading
})

const pad = n => (n < 10 ? '0' + n : String(n))
const isFav = id => store.isFavorite(id)

/*
 * 滚动记忆：没传 key 的页面用组件内 savedTop；传了 key（歌单详情）用模块级 Map，
 * 因为 KeepAlive 会回收实例，组件内变量会丢。
 * pendingTop 先挂着不写：数据异步加载，太早设 scrollTop 会被没撑开的容器钳到 0。
 */
let savedTop = 0
let pendingTop = null
let restoreAttempts = 0
// 进入时固化的 key。不能用 props.scrollMemoryKey 当场算：
// 离开时 route 先变、params.id 变空，computed 的 key 会塌成 'playlist-detail:'，
// 结果存进空 key、回来按带 id 的 key 取，永远对不上。
let activeKey = ''
const MAX_RESTORE_ATTEMPTS = 90 // 约 1.5s，够等异步数据 + 虚拟列表撑开，又不会无限循环

const applyPendingTop = () => {
  if (!activeKey || pendingTop == null) return
  const el = containerProps.ref.value
  if (!el) return
  requestAnimationFrame(() => {
    const target = containerProps.ref.value
    if (!target || pendingTop == null) return
    // 虚拟列表 wrapper 还没撑开（数据刚到 / 组件刚切回来），自己重试几帧。
    // 不能只等 watch(songs.length)：数据是从 store 同步读的，length 只变一次，
    // 那一次高度没撑开就 return 的话位置会永远挂在那儿写不进去。
    if (pendingTop > 0 && target.scrollHeight <= target.clientHeight + 1) {
      if (restoreAttempts++ < MAX_RESTORE_ATTEMPTS) requestAnimationFrame(applyPendingTop)
      return
    }
    restoreAttempts = 0
    target.scrollTop = pendingTop
    pendingTop = null
  })
}

onDeactivated(() => {
  const el = containerProps.ref.value
  if (activeKey) {
    if (el) saveScroll(activeKey, el)
  } else {
    savedTop = el ? el.scrollTop : 0
  }
})

// mounted 和 activated 都要恢复：路由用 :key + Transition，切走回来是重建不是缓存
const restoreOnEnter = () => {
  activeKey = props.scrollMemoryKey // 此刻 route 是本歌单，params.id 正确
  if (activeKey) {
    // 不直接滚，数据异步没高度；取出来挂着，和 restoreScroll 共用判空避免重复 take
    if (pendingTop == null) pendingTop = takeScroll(activeKey)
    applyPendingTop()
    return
  }
  const el = containerProps.ref.value
  if (!el || !savedTop) return
  requestAnimationFrame(() => {
    el.scrollTop = savedTop
  })
}

onMounted(restoreOnEnter)
onActivated(() => {
  // 重建场景 mounted 已取过；这里靠 pendingTop 判空跳过，避免重复 take
  restoreOnEnter()
})

// 数据到达 / 触底加载后列表长度变化，都是重试恢复的时机
watch(() => props.songs.length, applyPendingTop)

// 兜底固化：若某些场景 onActivated 尚未跑过（例如点歌发生在首帧），用此刻的正确 key 补上
const ensureActiveKey = () => {
  if (!activeKey && props.scrollMemoryKey) activeKey = props.scrollMemoryKey
}

defineExpose({
  scrollToTop: () => {
    const el = containerProps.ref.value
    if (el) el.scrollTop = 0
  },
  getScroller: () => containerProps.ref.value,
  // 点歌瞬间记下当前位置
  saveCurrentScroll: () => {
    ensureActiveKey()
    if (!activeKey) return
    const el = containerProps.ref.value
    if (el) saveScroll(activeKey, el)
  },
  // 数据就绪后由父组件主动触发；内部会等容器撑开再写
  restoreScroll: () => {
    ensureActiveKey()
    if (!activeKey) return
    if (pendingTop == null) pendingTop = takeScroll(activeKey)
    applyPendingTop()
  }
})
</script>

<template>
  <div class="vlist">
    <div class="vlist-head">
      <div class="col-idx">#</div>
      <div class="col-fav"></div>
      <div class="col-song">歌曲</div>
      <div v-if="!isMobile" class="col-album">专辑</div>
      <div class="col-time">时长</div>
    </div>

    <div v-bind="containerProps" class="vlist-body">
      <div v-bind="wrapperProps">
        <div
          v-for="row in list"
          :key="row.data.id ?? row.index"
          class="vlist-row"
          :class="{ 'is-playing': row.data.id === currentId }"
          @click="emit('row-click', row.data, row.index)"
        >
          <div class="col-idx index-num">{{ pad(row.index + 1) }}</div>
          <div class="col-fav">
            <i
              class="iconfont favorite-icon"
              :class="isFav(row.data.id) ? 'icon-aixin1-copy is-favorite' : 'icon-aixin'"
              :title="isFav(row.data.id) ? '取消喜欢' : '加入我喜欢的音乐'"
              @click.stop="emit('favorite-toggle', row.data)"
            ></i>
          </div>
          <div class="col-song">
            <SongCell :song="row.data" :cover-size="coverSize">
              <div class="song-name text-style" :title="row.data.name">{{ row.data.name }}</div>
              <div class="artist-names text-style">
                <ArtistLinks :artists="row.data.artists || row.data.ar" />
              </div>
            </SongCell>
          </div>
          <div v-if="!isMobile" class="col-album">
            <div class="text-style text-[12px]" :title="row.data.album?.name || row.data.al?.name">
              {{ row.data.album?.name || row.data.al?.name || '-' }}
            </div>
          </div>
          <div class="col-time">{{ timeFormat((row.data.duration || row.data.dt) / 1000) }}</div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="load-more-mask">
      <span class="load-more-spinner"></span>
    </div>

    <div v-if="!songs.length" class="vlist-empty">列表里还没有歌曲</div>
  </div>
</template>

<style scoped>
.vlist {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}

.vlist-head {
  display: flex;
  align-items: center;
  flex: none;
  height: 34px;
  border-bottom: 1px solid #000;
  color: #fff;
  font-size: 12px;
}

.vlist-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.vlist-row {
  display: flex;
  align-items: center;
  height: 60px;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.16s ease;
  /* 关掉移动端点击时那层系统蓝色高亮，用自己的按下色 */
  -webkit-tap-highlight-color: transparent;
}

@media (max-width: 767.98px) {
  .vlist-row {
    height: 52px;
  }
}

.vlist-row.is-playing {
  background-color: rgba(0, 153, 255, 0.16);
}

.vlist-row.is-playing .song-name {
  color: #6ec1ff;
}

/* 桌面：鼠标悬浮轻微提亮，播放行用同色系加深 */
@media (hover: hover) and (pointer: fine) {
  .vlist-row:hover {
    background-color: rgba(255, 255, 255, 0.07);
  }

  .vlist-row.is-playing:hover {
    background-color: rgba(0, 153, 255, 0.24);
  }
}

/* 按下反馈：手机没有 hover，靠这个给即时响应 */
.vlist-row:active {
  background-color: rgba(255, 255, 255, 0.14);
}

.vlist-row.is-playing:active {
  background-color: rgba(0, 153, 255, 0.3);
}

.col-idx {
  width: 40px;
  flex: none;
  text-align: center;
  font-size: 12px;
}

.col-fav {
  width: 44px;
  flex: none;
  text-align: center;
}

.col-song {
  flex: 1;
  min-width: 0;
}

.col-album {
  width: 130px;
  flex: none;
  padding-right: 0.5rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.col-time {
  width: 56px;
  flex: none;
  text-align: center;
  font-size: 12px;
}

/* 桌面端：歌曲 / 专辑 / 时长 按 5:3:2 分配剩余宽度 */
@media (min-width: 768px) {
  .col-song {
    flex: 5 1 0;
  }

  .col-album {
    flex: 3 1 0;
    width: auto;
    padding-right: 0.6rem;
  }

  .col-time {
    flex: 2 1 0;
    width: auto;
  }
}

.vlist-empty {
  position: absolute;
  top: 45%;
  left: 0;
  right: 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.82rem;
}

.text-style {
  @apply text-ellipsis overflow-hidden cursor-pointer whitespace-nowrap;
}

.song-name {
  font-size: 16px;
  color: white;
}

.artist-names {
  font-size: 10px;
  color: rgb(209, 213, 219);
}

.index-num {
  font-size: 16px;
}

.favorite-icon {
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition:
    color 0.2s ease,
    transform 0.2s ease;
}

.favorite-icon.is-favorite {
  color: #ff6b81;
}

@media (max-width: 639.98px) {
  .song-name {
    font-size: 14px;
    line-height: 1.35;
  }

  .artist-names {
    font-size: 11px;
    line-height: 1.3;
  }

  .index-num {
    font-size: 12px;
  }
}
</style>
