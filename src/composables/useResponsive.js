/*
 * @Author: Matbin
 * @Date: 2026-11-13
 * @Description: 设备能力与断点判断（全局单例，避免每个组件各建一个 matchMedia 监听）
 *
 * 断点与 Tailwind 的 sm 对齐（640px），保证 CSS 与 JS 判断不会打架：
 * 之前 musicDisplay 用 640 判 isMobile，而元素上的背景色用的是 max-sm:，
 * 两者一致才能让「抽屉什么时候该有背景色」和「什么时候该变成覆盖层」同步。
 */
import { ref } from 'vue'

// 手机 / 窄屏
const MOBILE_QUERY = '(max-width: 639.98px)'
// 有精确指针、且支持 hover 的设备：桌面端鼠标。
// 用能力判断而不是纯宽度：平板（含 iPad）即便宽度超过 1024，指针也是 coarse / 不支持 hover，
// 这类设备上「悬浮出提示」没有意义，还会被点击后的粘滞 hover 误触发。
const HOVER_QUERY = '(hover: hover) and (pointer: fine)'

const isMobile = ref(false)
const canHover = ref(false)
let initialized = false

const bind = (query, target) => {
  const mql = window.matchMedia(query)
  target.value = mql.matches
  const onChange = event => {
    target.value = event.matches
  }
  // Safari 14 以下只有 addListener
  if (mql.addEventListener) mql.addEventListener('change', onChange)
  else if (mql.addListener) mql.addListener(onChange)
}

const init = () => {
  if (initialized || typeof window === 'undefined' || !window.matchMedia) return
  initialized = true
  bind(MOBILE_QUERY, isMobile)
  bind(HOVER_QUERY, canHover)
}

init()

/**
 * 是否处于移动端窄屏
 * @returns {import('vue').Ref<boolean>}
 */
export function useIsMobile () {
  init()
  return isMobile
}

/**
 * 当前设备是否支持鼠标悬浮（桌面端为 true，手机/平板为 false）
 * @returns {import('vue').Ref<boolean>}
 */
export function useCanHover () {
  init()
  return canHover
}
