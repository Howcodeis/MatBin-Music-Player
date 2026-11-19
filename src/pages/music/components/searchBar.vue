<script setup>
import { computed, defineOptions, inject, nextTick, ref, watch } from 'vue'
import gsap from 'gsap'
import { musicStatus } from '@/store'
import { useRoute, useRouter } from 'vue-router'
import {
  useSearchHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory
} from '@/composables/useSearchHistory'
import { useFavoriteFilter } from '@/composables/useFavoriteFilter'
import { useArtistFilter } from '@/composables/useArtistFilter'

defineOptions({
  name: 'SearchBar'
})

const router = useRouter()
const route = useRoute()
// 避免和 window.history 同名，这里改个名字
const { history: searchHistory } = useSearchHistory()
// 收藏页的本地筛选关键词（和 favorite.vue 共用同一个 ref）
const { keyword: favoriteKeyword } = useFavoriteFilter()
// 歌手页的本地筛选关键词（和 artistSongs.vue 共用同一个 ref）
const { keyword: artistKeyword, resetArtistKeyword } = useArtistFilter()

/*
 * 搜索框有两种模式，由当前路由决定：
 * - favorite 页：只做本地筛选，不发请求、不记搜索历史、不跳路由；
 * - 其他页：网络搜索（回车 / 点按钮 → 请求接口 → 结果展示在列表页）。
 */
const isFavoriteMode = computed(() => route.name === 'favorite')
// 歌手页同样是页内筛选：只在已加载的歌手热门里过滤，不发网络请求
const isArtistMode = computed(() => route.name === 'artistSongs')
// 所有页内筛选模式的集合，用来统一控制搜索历史面板
const isLocalFilterMode = computed(() => isFavoriteMode.value || isArtistMode.value)

const inputPlaceholder = computed(() => {
  if (isFavoriteMode.value) return '搜索我喜欢的音乐'
  if (isArtistMode.value) return '搜索该作者的热门歌曲'
  return '搜索歌曲'
})

// 搜索关键字
const keywords = ref('')
// 移动端侧栏开关
const siderMenu = inject('siderMenu', null)
const showSiderMenu = () => siderMenu?.showSiderMenu?.()

// 列表页的网络搜索
const searchMusic = value => {
  const keyword = String(value ?? '').trim()
  if (!keyword) return
  keywords.value = keyword
  addSearchHistory(keyword)
  closeHistory()
  musicStatus().setMusicList(keyword)
  router.push({ name: 'playList' })
}

// 输入：收藏页 / 歌手页实时筛选，列表页不做任何事（等回车）
const handleInput = () => {
  if (isFavoriteMode.value) favoriteKeyword.value = keywords.value
  else if (isArtistMode.value) artistKeyword.value = keywords.value
}

// 回车 / 点搜索按钮：收藏页、歌手页只确认一次筛选，其余页走网络搜索
const handleSubmit = () => {
  if (isFavoriteMode.value) {
    favoriteKeyword.value = keywords.value
    closeHistory()
    return
  }
  if (isArtistMode.value) {
    artistKeyword.value = keywords.value
    closeHistory()
    return
  }
  searchMusic(keywords.value)
}

// 进出收藏页时清掉输入和筛选条件，避免上次的关键词悄悄过滤收藏列表
watch(isFavoriteMode, () => {
  keywords.value = ''
  favoriteKeyword.value = ''
  closeHistory()
})

// 进出歌手页时同理，避免上一个歌手的关键词悄悄过滤新的歌手列表
watch(isArtistMode, () => {
  keywords.value = ''
  resetArtistKeyword()
  closeHistory()
})

// 在歌手页内从 A 歌手切到 B 歌手（点列表里的合作歌手）时，输入框也要跟着清空
watch(
  () => route.params.id,
  () => {
    if (!isArtistMode.value) return
    keywords.value = ''
    resetArtistKeyword()
  }
)

/* ---------------- 搜索历史面板 ---------------- */
const isHistoryOpen = ref(false)
const panelRef = ref(null)
const listRef = ref(null)
// 记录关闭补间，快速反复聚焦时能把它掐掉，避免 onComplete 把刚打开的面板又关掉
let closeTween = null

const openHistory = () => {
  // 收藏页 / 歌手页是本地筛选，不展示网络搜索历史
  if (isLocalFilterMode.value) return
  if (!searchHistory.value.length) return
  // 关闭动画进行到一半又重新聚焦：先把补间掐掉并立刻复位，否则会停在半透明
  if (closeTween) {
    closeTween.kill()
    closeTween = null
    if (panelRef.value) gsap.set(panelRef.value, { autoAlpha: 1, y: 0 })
  }
  if (isHistoryOpen.value) return
  isHistoryOpen.value = true
  nextTick(() => {
    if (!panelRef.value) return
    // 面板整体下压淡入，条目再做一次轻微右移的错位入场
    gsap.fromTo(
      panelRef.value,
      { autoAlpha: 0, y: -8 },
      { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out' }
    )
    if (listRef.value?.children.length) {
      gsap.fromTo(
        listRef.value.children,
        { autoAlpha: 0, x: -10 },
        { autoAlpha: 1, x: 0, duration: 0.24, stagger: 0.035, ease: 'power2.out', delay: 0.04 }
      )
    }
  })
}

const closeHistory = () => {
  if (!isHistoryOpen.value || !panelRef.value) {
    isHistoryOpen.value = false
    return
  }
  if (closeTween) closeTween.kill()
  closeTween = gsap.to(panelRef.value, {
    autoAlpha: 0,
    y: -8,
    duration: 0.16,
    ease: 'power2.in',
    onComplete: () => {
      isHistoryOpen.value = false
      closeTween = null
    }
  })
}

// 点历史记录：回填搜索框并直接搜索
const applyHistory = keyword => {
  searchMusic(keyword)
}

// 单条删除：先让这一行缩一下淡出，再从数据里移除
const handleRemove = (keyword, index) => {
  const row = listRef.value?.children?.[index]
  if (!row) {
    removeSearchHistory(keyword)
    return
  }
  gsap.to(row, {
    autoAlpha: 0,
    x: 12,
    duration: 0.16,
    ease: 'power2.in',
    onComplete: () => {
      removeSearchHistory(keyword)
      // 删空了就直接收起面板
      if (!searchHistory.value.length) closeHistory()
    }
  })
}

const handleClear = () => {
  clearSearchHistory()
  closeHistory()
}
</script>

<template>
  <div class="flex items-center w-full px-2 sm:px-5">
    <!-- 移动端菜单按钮：窄屏下侧栏默认隐藏，没有入口就切不了路由 -->
    <button
      class="iconfont icon-caidan1 mr-2 shrink-0 sm:hidden"
      title="菜单"
      @click="showSiderMenu"
    ></button>
    <div
      class="relative border-[#999999] flex items-center rounded-full border-[.125rem] w-[60%] max-w-[14.375rem] max-sm:flex-1 max-sm:max-w-none"
    >
      <div class="relative w-[84%] h-full">
        <input
          v-model="keywords"
          type="text"
          class="border-0 w-full outline-none text-[#FFFFFF] bg-opacity-50 p-1 text-sm bg-transparent"
          :placeholder="inputPlaceholder"
          @input="handleInput"
          @focus="openHistory"
          @click="openHistory"
          @blur="closeHistory"
          @keydown.enter="handleSubmit"
          @keydown.esc="closeHistory"
        />
      </div>
      <div class="absolute right-0 w-[16%] flex justify-center">
        <button :title="isLocalFilterMode ? '在当前列表里查找' : '搜索'" @click="handleSubmit">
          <i class="iconfont icon-sousuo select-none"></i>
        </button>
      </div>

      <!-- 搜索历史：聚焦时展开在搜索框正下方 -->
      <div v-if="isHistoryOpen" ref="panelRef" class="history-panel" @mousedown.prevent>
        <div class="history-head">
          <span>搜索历史</span>
          <button class="history-clear" @click="handleClear">清空</button>
        </div>
        <ul ref="listRef">
          <li v-for="(item, index) in searchHistory" :key="item" class="history-row">
            <button class="history-item" :title="item" @click="applyHistory(item)">
              <span class="history-text">{{ item }}</span>
            </button>
            <button
              class="history-del"
              title="删除这条记录"
              @click.stop="handleRemove(item, index)"
            >
              ×
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.iconfont {
  @apply text-2xl hover:text-[#0099FF] duration-500 text-[#999999];
}

/* 搜索历史面板：贴在搜索框正下方 */
.history-panel {
  position: absolute;
  top: calc(100% + 0.4rem);
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 14rem;
  overflow-y: auto;
  padding: 0.2rem 0 0.3rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.6rem;
  background: rgba(26, 26, 48, 0.96);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}

.history-panel::-webkit-scrollbar {
  width: 4px;
}

.history-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.6rem 0.35rem;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.45);
}

.history-clear {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.45);
  transition: color 0.2s ease;
}

.history-clear:hover {
  color: #99ccff;
}

.history-row {
  position: relative;
}

.history-item {
  display: block;
  width: 100%;
  padding: 0.32rem 1.7rem 0.32rem 0.6rem;
  text-align: left;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.82);
  transition:
    background 0.16s ease,
    color 0.16s ease;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

/* 单行文字截断，长歌名不会把面板撑开 */
.history-text {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.history-del {
  position: absolute;
  top: 50%;
  right: 0.35rem;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 9999px;
  font-size: 0.85rem;
  line-height: 1;
  color: rgba(255, 255, 255, 0.3);
  transition:
    color 0.16s ease,
    background 0.16s ease;
}

.history-del:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.18);
}

/* 窄屏把行高和删除热区放大，手指点得到 */
@media (max-width: 639.98px) {
  .history-item {
    padding: 0.55rem 2.2rem 0.55rem 0.7rem;
    font-size: 0.85rem;
  }

  .history-del {
    right: 0.5rem;
    width: 1.7rem;
    height: 1.7rem;
    font-size: 1rem;
  }

  .history-head {
    padding: 0.35rem 0.7rem 0.4rem;
  }
}
</style>
