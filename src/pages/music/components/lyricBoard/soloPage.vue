<script setup>
import { storeToRefs } from 'pinia'
import { musicStatus } from '@/store'
import gsap from 'gsap'
import { lyricEnter, lyricLeave } from '@/utils/gsapTools'
import { defineOptions, nextTick, onMounted, onUnmounted, ref, watch, computed } from 'vue'
import lyricPanel from './lyricPanel.vue'
import ArtistLinks from '../artistLinks.vue'
import { normalBack } from '@/utils/MessageBack'

defineOptions({
  name: 'SoloPage'
})

// 将store值响应化
const { currentMusicInfo, getCurrentLyricIndex, getCurrentTime, isShowScrollLyrics } =
  storeToRefs(musicStatus())

// 当前歌词 / 上一句歌词：两个元素做交叉淡变，避免同一个节点被复用导致出场动画丢失
const currentWord = ref('')
const prevWord = ref('')
// 官方翻译歌词（tlyric 已按时间戳对齐，挂在每行的 tword 上）
const currentTWord = ref('')
const prevTWord = ref('')
const lyricItem = ref(null)
const prevLyricItem = ref(null)

const getLyricAt = index => currentMusicInfo.value.lyric?.[index]

// 距离下一句歌词还有多少秒（用于缩放当前句的入场时长）
const calculateTimeUntilNextLyric = () => {
  const index = getCurrentLyricIndex.value
  const nextTime = getLyricAt(index + 1)?.time
  if (nextTime == null) return 0
  return Math.max(nextTime - getCurrentTime.value, 0)
}

// 上一句与当前句同步渲染，并在渲染后播放交叉淡变
const renderLyric = async () => {
  const line = getLyricAt(getCurrentLyricIndex.value)
  const nextWord = line?.word ?? ''
  const nextTWord = line?.tword ?? ''
  // 原文和翻译都没变就不重播动画（索引来回跳时可能重复触发）
  if (nextWord === currentWord.value && nextTWord === currentTWord.value) return

  prevWord.value = currentWord.value
  prevTWord.value = currentTWord.value
  currentWord.value = nextWord
  currentTWord.value = nextTWord
  await nextTick()

  // 上一句立即淡出：等下一句时刻再出场的话，索引已变、时间线被 clear，动画播不完
  lyricLeave(prevLyricItem.value)
  lyricEnter(lyricItem.value, calculateTimeUntilNextLyric())
}

// 歌词索引变化 / 切换歌曲时重建动画；immediate 保证刷新恢复时立刻显示当前句
watch([() => currentMusicInfo.value.id, getCurrentLyricIndex], renderLyric, { immediate: true })

// 切换动画
const AnimationLyric = ref(null)
const lyc = ref(null)
const toggleLyricBoardStyle = () => {
  if (!AnimationLyric.value) {
    return normalBack('warning', '歌词面板切换失败,请检查资源获取是否正常!')
  }
  // 滚动歌词用的是 v-if，切过去之后要等 DOM 渲染出来才能做入场动画
  if (!isShowScrollLyrics.value) {
    gsap.to(AnimationLyric.value, {
      autoAlpha: 0,
      duration: 0.5,
      force3D: true,
      onComplete: async () => {
        isShowScrollLyrics.value = true
        await nextTick()
        gsap.fromTo(lyc.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 })
      }
    })
  } else {
    gsap.to(lyc.value, {
      autoAlpha: 0,
      duration: 0.5,
      force3D: true,
      onComplete: async () => {
        isShowScrollLyrics.value = false
        await nextTick()
        gsap.fromTo(AnimationLyric.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2 })
      }
    })
  }
}
const container = ref(null)

/* 底部评论气泡 */
const PAGE_SIZE = 6
const MAX_COMMENTS = 30
const commentPage = ref(0)
const commentGrid = ref(null)

const allComments = computed(() => {
  const list = currentMusicInfo.value.comments
  return Array.isArray(list) ? list.slice(0, MAX_COMMENTS) : []
})
const totalPages = computed(() => Math.max(1, Math.ceil(allComments.value.length / PAGE_SIZE)))
const visibleComments = computed(() =>
  allComments.value.slice(commentPage.value * PAGE_SIZE, commentPage.value * PAGE_SIZE + PAGE_SIZE)
)

// 超过 999 显示 999+
const formatLikes = count => {
  const n = Number(count)
  if (!Number.isFinite(n) || n < 0) return '0'
  return n > 999 ? '999+' : String(Math.floor(n))
}

// 换一批评论，不发请求
const refreshComments = () => {
  commentPage.value = (commentPage.value + 1) % totalPages.value
  nextTick(() => {
    const cells = commentGrid.value?.children
    if (!cells?.length) return
    // 动画时关毛玻璃，免得每帧重算；只动外层，skew 在里层不会被覆盖
    for (const el of cells) el.classList.add('is-moving')
    gsap.fromTo(
      cells,
      { autoAlpha: 0, y: 8 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.28,
        stagger: 0.04,
        ease: 'power2.out',
        force3D: true,
        onComplete: () => {
          for (const el of cells) el.classList.remove('is-moving')
        }
      }
    )
  })
}

// 换歌时回到第一批
watch(
  () => currentMusicInfo.value.id,
  () => {
    commentPage.value = 0
  }
)

// 评论区折叠：.lyric-block 用 flex:1 吃满剩余高度，塌缩时歌词自动下移居中
const showComments = ref(false)
const toggleComments = () => {
  showComments.value = !showComments.value
}

onMounted(() => {
  gsap.from(container.value.children, {
    duration: 0.75,
    autoAlpha: 0,
    y: 20,
    force3D: true
  })
})
onUnmounted(() => {
  gsap.killTweensOf([lyricItem.value, prevLyricItem.value])
})
</script>

<template>
  <div ref="container" class="box w-full h-full overflow-scroll flex flex-col">
    <!-- 歌词特殊界面 -->
    <div class="relative w-full h-full max-md:flex-col flex-row flex-center">
      <!-- 歌手 / 歌词 / 评论 纵向排布：评论收起时歌词块自动长高，歌词随之下移居中 -->
      <div class="song-col">
        <!-- 歌手 + 歌词 + 歌词轮播：整块 flex:1，评论区塌缩时长高 -->
        <div class="lyric-block">
          <!-- 歌手 -->
          <div class="w-full h-[25%] flex-center">
            <div class="w-full text-center">
              <span class="text-slate-300 text-xl block">
                {{ currentMusicInfo.name || '暂无歌曲' }}
              </span>
              <span class="text-slate-300 text-sm">
                <ArtistLinks :artists="currentMusicInfo.artists" />
              </span>
            </div>
          </div>
          <!-- 歌词 -->
          <div v-show="!isShowScrollLyrics" ref="AnimationLyric" class="w-full h-[75%] flex-center">
            <div class="relative w-full h-full flex-center" @click="toggleLyricBoardStyle">
              <!-- 上一句：只负责淡出 -->
              <span ref="prevLyricItem" class="lyric-line">
                <span class="lyric">{{ prevWord }}</span>
                <span v-if="prevTWord" class="lyric-trans">{{ prevTWord }}</span>
              </span>
              <!-- 当前句：负责入场 -->
              <span ref="lyricItem" class="lyric-line">
                <span class="lyric">{{ currentWord }}</span>
                <span v-if="currentTWord" class="lyric-trans">{{ currentTWord }}</span>
              </span>
            </div>
          </div>
          <!-- 歌词轮播：不显示时别渲染，歌词列表几十行，常驻 DOM 会拖慢进场 -->
          <div
            v-if="isShowScrollLyrics"
            ref="lyc"
            class="select-none w-full h-[75%] flex-center flex-col pb-1"
            @click="toggleLyricBoardStyle"
          >
            <lyricPanel :is-show-scroll-lyrics="isShowScrollLyrics"></lyricPanel>
          </div>
        </div>

        <!-- 折叠控制条：常驻，评论收起后仍在，可随时再展开 -->
        <div class="comment-toggle-bar">
          <button
            class="comment-toggle"
            type="button"
            :title="showComments ? '收起评论' : '展开评论'"
            @click="toggleComments"
          >
            <svg
              class="chevron"
              :class="{ up: !showComments }"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden="true"
            >
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>评论</span>
          </button>
        </div>

        <!-- 底部评论气泡：每行 3 个共 2 行，平行四边形；整块随 showComments 塌缩 -->
        <div class="comment-zone" :class="{ 'is-collapsed': !showComments }">
          <div v-if="!allComments.length" class="comment-empty">暂无评论</div>
          <template v-else>
            <div ref="commentGrid" class="comment-grid">
              <div
                v-for="(item, index) in visibleComments"
                :key="item.commentId ?? index"
                class="comment-cell"
              >
                <div class="comment-bubble">
                  <div class="comment-inner">
                    <p class="comment-text" :title="item.content">
                      {{ item.content || '（空评论）' }}
                    </p>
                    <span class="comment-likes" :title="`${item.likedCount || 0} 人点赞`">
                      <i class="iconfont icon-dianzan"></i>
                      {{ formatLikes(item.likedCount) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <button class="comment-refresh" title="换一批评论" @click="refreshComments">
              <i class="iconfont icon-huanyipi"></i>
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.box {
  @apply absolute w-full h-full;
}

.box::-webkit-scrollbar {
  display: none;
}

.flex-center {
  @apply flex justify-center items-center;
}

.lyric-line {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: center;
  justify-content: center;
  width: 100%;
  pointer-events: none;
  /* 提前提层：动画里带 filter，不提层就会每帧重算模糊 */
  will-change: transform, opacity, filter;
  backface-visibility: hidden;
}

.lyric {
  display: inline-block;
  padding: 0 0.5rem;
  text-align: center;
  white-space: pre-wrap;
  font-weight: 550;
  font-size: 1.5rem;
  line-height: 1.5;
  color: #ffffff;
  background: linear-gradient(180deg, #ffffff 0%, #dfe7f5 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* 翻译行：实色而不是渐变，避免和主歌词的 background-clip 抢文字渲染 */
.lyric-trans {
  display: inline-block;
  max-width: 90%;
  padding: 0 0.5rem;
  text-align: center;
  white-space: pre-wrap;
  font-size: 0.95rem;
  line-height: 1.45;
  color: rgba(223, 231, 245, 0.72);
}

@media (max-width: 768px) {
  .lyric {
    font-size: 1.25rem;
  }

  .lyric-trans {
    font-size: 0.8rem;
  }
}

/* 歌手 / 歌词 / 评论 纵向布局 */
.song-col {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

/* 吃满剩余高度，评论区塌缩时自动长高把歌词顶下去 */
.lyric-block {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 折叠控制条：常驻可见，垂直居中摆放箭头 */
.comment-toggle-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem 0 0.3rem;
}

/* 折叠按钮：向下箭头=评论展开，向上箭头=评论收起 */
.comment-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.78rem;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.comment-toggle:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.16);
}

.chevron {
  display: block;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 收起评论时箭头翻转成向上 */
.chevron.up {
  transform: rotate(180deg);
}

/* 底部评论气泡 */
.comment-zone {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  box-sizing: border-box;
  width: 100%;
  height: 20%;
  min-height: 6rem;
  padding: 0.35rem 1rem 0.75rem;
  overflow: hidden;
  /* 塌缩 + 淡出，歌词块随 flex 重排下移 */
  transition:
    height 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    min-height 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.35s ease,
    padding-top 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    padding-bottom 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.comment-zone.is-collapsed {
  height: 0;
  min-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* 胶囊本身是椭圆，第二行右移拼出平行四边形轮廓；用 left 错位，不占宽度也不和 GSAP 的 transform 打架 */
.comment-grid {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 0.4rem 0.85rem;
  /* 给第二行的右移留出空间，避免胶囊压到右侧刷新按钮 */
  padding-right: 2.4rem;
  box-sizing: border-box;
}

/* 动画作用在这一层：GSAP 写 y 会覆盖 transform，所以别把造型放这里 */
.comment-cell {
  position: relative;
  min-width: 0;
  height: 100%;
  /* 翻页时批量做透明度位移动画，提前提层避免重绘 */
  will-change: transform, opacity;
}

/* 第 4~6 条（第二行）右移，形成平行四边形的斜边 */
.comment-cell:nth-child(n + 4) {
  left: 2.4rem;
}

.comment-bubble {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(6px);
  overflow: hidden;
  transition: background 0.2s ease;
}

.comment-bubble:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 翻页时关毛玻璃省性能，这个尺寸下看不出差别 */
.comment-cell.is-moving .comment-bubble {
  backdrop-filter: none;
}

.comment-inner {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  height: 100%;
  /* 两端是圆弧，多留点内边距文字才不贴弧边 */
  padding: 0.25rem 1.15rem;
}

.comment-text {
  flex: 1;
  min-width: 0;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.72rem;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.85);
}

/* 点赞数在评论右侧，等宽数字避免数字变化时抖动 */
.comment-likes {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.68rem;
  color: #ff8fa3;
  font-variant-numeric: tabular-nums;
}

.comment-likes .iconfont {
  font-size: 0.75rem;
  color: #ff6b81;
}

.comment-refresh {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
  transition:
    color 0.2s ease,
    background 0.2s ease,
    transform 0.35s ease;
}

.comment-refresh:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.18);
  transform: rotate(90deg);
}

.comment-refresh .iconfont {
  font-size: 1.05rem;
}

.comment-empty {
  flex: 1;
  text-align: center;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.4);
}

@media (max-width: 768px) {
  .comment-zone {
    min-height: 5.2rem;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem 0.5rem;
  }

  .comment-grid {
    gap: 0.25rem 0.45rem;
    /* 比第二行的右移量多留 0.4rem，给最右侧胶囊和刷新按钮之间留间隙 */
    padding-right: 1.6rem;
  }

  /* 窄屏缩小错位量，最右侧胶囊才不会顶到刷新按钮 */
  .comment-cell:nth-child(n + 4) {
    left: 1.2rem;
  }

  .comment-inner {
    padding: 0.15rem 0.7rem;
    gap: 0.2rem;
  }

  .comment-text {
    font-size: 0.58rem;
  }

  .comment-likes {
    font-size: 0.55rem;
  }

  .comment-likes .iconfont {
    font-size: 0.62rem;
  }

  .comment-refresh {
    width: 1.8rem;
    height: 1.8rem;
  }

  .comment-refresh .iconfont {
    font-size: 0.9rem;
  }
}
</style>
