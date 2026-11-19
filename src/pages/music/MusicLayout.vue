<script setup>
import { defineOptions, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import searchBar from './components/searchBar.vue'
import siderMenu from './components/siderMenu.vue'
import { useIsMobile } from '@/composables/useResponsive'
import { drawerOpen, drawerClose, drawerSetClosed, drawerReset } from '@/utils/gsapTools'

defineOptions({
  name: 'MusicLayout'
})

// 窄屏判定与 Tailwind 的 sm 断点保持一致，避免 CSS 和 JS 各说各话
const isMobile = useIsMobile()

const router = useRouter()

// 切页动画方向：进详情页从右推入，退出反向滑回，平级标签之间淡变
const pageTransition = ref('')
const stopTransition = router.afterEach((to, from) => {
  if (!from.path.startsWith('/music/') || !to.path.startsWith('/music/')) {
    pageTransition.value = ''
    return
  }
  const toDepth = to.meta.depth ?? 0
  const fromDepth = from.meta.depth ?? 0
  pageTransition.value =
    toDepth > fromDepth ? 'slide-forward' : toDepth < fromDepth ? 'slide-back' : 'fade-tag'
})
onUnmounted(stopTransition)

// 抽屉的开关状态由父级 music.vue 持有
const siderMenuCtx = inject('siderMenu', null)
const isShowSiderMenu = siderMenuCtx?.isShowSiderMenu || ref(false)
const closeSiderMenu = () => {
  if (isShowSiderMenu.value) isShowSiderMenu.value = false
}

const drawerRef = ref(null)
const maskRef = ref(null)

/**
 * 同步抽屉状态
 * @param {boolean} animate 是否需要动画（首次挂载、切换断点时直接落位）
 */
const syncDrawer = (animate = false) => {
  // 宽屏下永远是常驻布局，清掉动画残留的内联样式
  if (!isMobile.value) {
    drawerReset(drawerRef.value, maskRef.value)
    return
  }
  if (!isShowSiderMenu.value) {
    drawerSetClosed(drawerRef.value, maskRef.value)
    return
  }
  if (animate) drawerOpen(drawerRef.value, maskRef.value)
}

// 展开/收起：带 GSAP 动画
watch(
  isShowSiderMenu,
  async open => {
    if (!isMobile.value) return
    // 等 DOM（遮罩可能刚挂载）就绪再播放
    await nextTick()
    if (open) drawerOpen(drawerRef.value, maskRef.value)
    else drawerClose(drawerRef.value, maskRef.value)
  },
  { flush: 'post' }
)

// 断点切换：宽屏收起状态并复位，窄屏保持关闭
watch(
  isMobile,
  mobile => {
    if (!mobile) isShowSiderMenu.value = false
    nextTick(() => syncDrawer(false))
  },
  { flush: 'post' }
)

onMounted(() => {
  nextTick(() => syncDrawer(false))
})

// 移动端点击菜单项跳转后自动收起
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    if (isMobile.value) closeSiderMenu()
  }
)
</script>

<template>
  <!-- 移动端遮罩：点击空白处收起抽屉 -->
  <div v-if="isMobile" ref="maskRef" class="sider-mask" @click="closeSiderMenu"></div>

  <!-- 侧栏：宽屏常驻，窄屏为覆盖式抽屉 -->
  <aside ref="drawerRef" class="sider-panel" :class="{ 'sider-panel--drawer': isMobile }">
    <!-- 侧栏收起按钮 -->
    <button
      v-if="isMobile"
      class="sider-close"
      title="收起菜单"
      aria-label="收起菜单"
      @click="closeSiderMenu"
    >
      <i class="iconfont icon-xiangzuo"></i>
    </button>
    <siderMenu />
  </aside>

  <div class="relative w-full h-full min-w-0">
    <div
      class="relative border-b-[1px] border-gradient flex items-center h-[10%] right-0 min-h-[3.125rem] z-10"
    >
      <searchBar></searchBar>
    </div>
    <div class="relative overflow-scroll h-[90%]">
      <!-- 播放列表路由：缓存子页面，切标签不重新挂载；详情页滑动切换，平级页淡变 -->
      <router-view v-slot="{ Component, route: childRoute }">
        <Transition :name="pageTransition">
          <KeepAlive :max="6">
            <component :is="Component" :key="childRoute.fullPath" />
          </KeepAlive>
        </Transition>
      </router-view>
    </div>
  </div>
</template>

<style scoped>
/* 详情页从右推入，列表页轻微左移淡出 */
.slide-forward-enter-from {
  transform: translateX(100%);
}

.slide-forward-enter-active {
  transition: transform 0.28s ease;
  z-index: 2;
  will-change: transform;
}

.slide-forward-leave-active {
  transition:
    transform 0.28s ease,
    opacity 0.28s ease;
  z-index: 1;
  will-change: transform, opacity;
}

.slide-forward-leave-to {
  transform: translateX(-24%);
  opacity: 0;
}

/* 退出详情页：反向滑回 */
.slide-back-enter-from {
  transform: translateX(-24%);
  opacity: 0;
}

.slide-back-enter-active {
  transition:
    transform 0.28s ease,
    opacity 0.28s ease;
  z-index: 1;
  will-change: transform, opacity;
}

.slide-back-leave-active {
  transition: transform 0.28s ease;
  z-index: 2;
  will-change: transform;
}

.slide-back-leave-to {
  transform: translateX(100%);
}

/* 列表页之间：淡变 */
.fade-tag-enter-from,
.fade-tag-leave-to {
  opacity: 0;
}

.fade-tag-enter-active,
.fade-tag-leave-active {
  transition: opacity 0.5s ease;
  will-change: opacity;
}

.border-gradient {
  border-image: linear-gradient(to right, gray, white) 1;
}

.sider-panel {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  width: 10%;
  min-width: 124px;
  height: 100%;
  color: #fff;
  border-right: 1px solid rgba(255, 255, 255, 0.18);
}

/* 遮罩：默认不可见，由 GSAP 控制透明度 */
.sider-mask {
  position: absolute;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  visibility: hidden;
}

@media (max-width: 639.98px) {
  .sider-panel--drawer {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 40;
    width: 64%;
    min-width: 180px;
    max-width: 250px;
    padding-top: 2.75rem;
    border-right: 0;
    border-radius: 0 1rem 1rem 0;
    background: linear-gradient(165deg, #3a3a6b 0%, #232340 100%);
    box-shadow: 12px 0 32px rgba(0, 0, 0, 0.5);
    opacity: 0;
    visibility: hidden;
  }

  .sider-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    color: #99ccff;
    background: rgba(255, 255, 255, 0.08);
    transition:
      background 0.2s ease,
      color 0.2s ease;
  }

  .sider-close:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.18);
  }
}
</style>
