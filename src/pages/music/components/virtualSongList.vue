<script setup>
/*
 * 虚拟滚动的歌曲列表，替代 el-table。
 * el-table 会把所有行都渲染成 DOM，几百行时滚动明显卡；这里只渲染可视区域内的行。
 */
import { computed, onActivated, onDeactivated } from 'vue'
import { useMediaQuery, useVirtualList, useInfiniteScroll } from '@vueuse/core'
import { timeFormat } from '@/utils/music'
import { musicStatus } from '@/store'
import SongCell from './songCell.vue'
import ArtistLinks from './artistLinks.vue'

defineOptions({
  name: 'VirtualSongList'
})

const props = defineProps({
  songs: { type: Array, default: () => [] },
  currentId: { type: [String, Number], default: '' },
  loading: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: true }
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
  // 没有更多 / 正在加载时不再触发，避免数据不满一屏时反复请求
  canLoad: () => props.hasMore && !props.loading
})

const pad = n => (n < 10 ? '0' + n : String(n))
const isFav = id => store.isFavorite(id)

/*
 * KeepAlive 缓存页面时会把 DOM 移出文档，scrollTop 会被浏览器清零，
 * 切回来就回到顶部了。在这里离开前记下、回来后还原。
 */
let savedTop = 0

onDeactivated(() => {
  const el = containerProps.ref.value
  savedTop = el ? el.scrollTop : 0
})

onActivated(() => {
  const el = containerProps.ref.value
  if (!el || !savedTop) return
  // 等这一帧渲染完，列表高度撑开了再滚，否则会被钳到 0
  requestAnimationFrame(() => {
    el.scrollTop = savedTop
  })
})

defineExpose({
  scrollToTop: () => {
    const el = containerProps.ref.value
    if (el) el.scrollTop = 0
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
