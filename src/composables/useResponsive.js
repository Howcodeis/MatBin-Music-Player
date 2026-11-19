/*
 * 设备能力与断点判断。
 * 用 VueUse 的 useMediaQuery 处理监听和兼容，模块级单例保证多个组件共享同一个 ref。
 */
import { useMediaQuery } from '@vueuse/core'

// 断点与 Tailwind 的 sm 对齐（640px），保证 CSS 与 JS 判断一致
const MOBILE_QUERY = '(max-width: 639.98px)'
// 用能力判断而不是宽度：平板即便够宽，指针也是 coarse，悬浮提示没有意义
const HOVER_QUERY = '(hover: hover) and (pointer: fine)'

const isMobile = useMediaQuery(MOBILE_QUERY)
const canHover = useMediaQuery(HOVER_QUERY)

/**
 * 是否处于移动端窄屏
 * @returns {import('vue').Ref<boolean>}
 */
export function useIsMobile() {
  return isMobile
}

/**
 * 当前设备是否支持鼠标悬浮（桌面端为 true，手机/平板为 false）
 * @returns {import('vue').Ref<boolean>}
 */
export function useCanHover() {
  return canHover
}
