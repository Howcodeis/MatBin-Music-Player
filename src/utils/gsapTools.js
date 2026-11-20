import gsap from 'gsap'

// 数值区间限制
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

/**
 * 歌词入场动画
 *
 * 说明：之前的实现是 把入场 + 延迟出场放在同一条时间线上，且复用同一个 DOM 节点。
 * 索引一变就 clear() 重建，导致上一句的出场动画永远播不完 —— 视觉上就是淡出消失。
 * 现在把入场/出场拆成两个独立函数，分别作用在当前句和上一句两个元素上，
 * 出场立即开始，不再等到下一句的时刻。
 *
 * @param {HTMLElement} el - 当前歌词元素
 * @param {number} [remaining=0] - 距离下一句歌词的剩余秒数，用于缩放入场时长
 * @returns {gsap.core.Tween|null}
 */
export function lyricEnter(el, remaining = 0) {
  if (!el) return null
  // 剩余时间越长，入场越从容；限制在 0.35s ~ 1.2s，避免极端值
  const duration = remaining > 0 ? clamp(remaining * 0.45, 0.35, 1.2) : 0.45
  return gsap.fromTo(
    el,
    {
      y: 18,
      autoAlpha: 0,
      filter: 'blur(2px)'
    },
    {
      y: 0,
      autoAlpha: 1,
      filter: 'blur(0px)',
      duration,
      ease: 'power2.out',
      force3D: true,
      overwrite: 'auto'
    }
  )
}

/**
 * 歌词出场动画：立即淡出并上浮
 * @param {HTMLElement} el - 上一句歌词元素
 * @returns {gsap.core.Tween|null}
 */
export function lyricLeave(el) {
  if (!el) return null
  return gsap.fromTo(
    el,
    {
      y: 0,
      autoAlpha: 1,
      filter: 'blur(0px)'
    },
    {
      y: -18,
      autoAlpha: 0,
      filter: 'blur(4px)',
      duration: 0.28,
      ease: 'power2.in',
      force3D: true,
      overwrite: 'auto'
    }
  )
}

/**
 * 创建图片旋转动画时间线
 * @param {gsap.core.Timeline} gsap - 工具 timeline
 * @param {Element} el - 目标元素
 * @param {number} duration - 动画时长，单位毫秒
 * returns {gsap.core.Timeline} - 返回传入的 timeline，方便链式调用
 */
export function picTimeline(timeline, el, duration = 60000) {
  // 参数有效性检查
  if (!timeline || !el) {
    console.error('Invalid timeline or element provided.')
    throw new Error('Invalid timeline or element provided.') // 抛出错误
  }
  timeline.to(el, {
    rotation: 360,
    duration: duration,
    repeat: -1,
    ease: 'linear'
  })
}

const ANIMATION_DURATION = 0.2 // 提取动画时长为常量

/**
 * 动画隐藏面板函数
 * 使用GSAP库进行动画处理，将目标元素隐藏起来。
 *
 * @param {HTMLElement} target - 需要进行隐藏动画的元素。
 * @param {number} y - 元素隐藏后的垂直偏移量，用于动画效果。
 * @param {Function} onComplete - 动画完成后的回调函数。
 */
export function PanelHideY(target, y, onComplete) {
  gsap.to(target, {
    y: y,
    autoAlpha: 0,
    duration: ANIMATION_DURATION,
    force3D: true,
    onComplete
  })
}

/**
 * 使用GSAP库动画化面板显示
 *
 * 该函数利用GSAP的fromTo方法来创建一个从起始位置到结束位置的动画效果，同时伴随透明度的变化，用于动画化显示面板或其他DOM元素。
 *
 * @param {HTMLElement} target - 需要进行动画化的DOM元素目标。
 * @param {number} startY - 动画开始时元素的y轴位置。
 * @param {number} endY - 动画结束时元素的y轴位置。
 */
export function PanelShowY(target, startY, endY) {
  gsap.fromTo(
    target,
    {
      y: startY,
      autoAlpha: 0
    },
    {
      y: endY,
      duration: 0.5,
      autoAlpha: 1,
      force3D: true
    }
  )
}

/* 移动端侧栏抽屉
 * 说明：autoAlpha 的 0 会同时把 visibility 设为 hidden，
 * 元素关闭后天然不可点击，所以不需要额外处理 pointer-events。
 */
const DRAWER_IN_DURATION = 0.36
const DRAWER_OUT_DURATION = 0.26
const MASK_DURATION = 0.2

/**
 * 打开抽屉：从左滑入 + 淡入，同时点亮遮罩
 * @param {HTMLElement} el 抽屉元素
 * @param {HTMLElement} [mask] 遮罩元素
 */
export function drawerOpen(el, mask) {
  if (mask) {
    gsap.to(mask, {
      autoAlpha: 1,
      duration: MASK_DURATION,
      ease: 'power1.out',
      overwrite: 'auto'
    })
  }
  if (!el) return null
  return gsap.fromTo(
    el,
    { xPercent: -100, autoAlpha: 0 },
    {
      xPercent: 0,
      autoAlpha: 1,
      duration: DRAWER_IN_DURATION,
      ease: 'power3.out',
      force3D: true,
      overwrite: 'auto'
    }
  )
}

/**
 * 关闭抽屉：向左滑出 + 淡出，同时熄灭遮罩
 * @param {HTMLElement} el 抽屉元素
 * @param {HTMLElement} [mask] 遮罩元素
 * @param {Function} [onComplete] 关闭完成回调
 */
export function drawerClose(el, mask, onComplete) {
  if (mask) {
    gsap.to(mask, {
      autoAlpha: 0,
      duration: MASK_DURATION,
      ease: 'power1.in',
      overwrite: 'auto',
      onComplete
    })
  }
  if (!el) return null
  return gsap.to(el, {
    xPercent: -100,
    autoAlpha: 0,
    duration: DRAWER_OUT_DURATION,
    ease: 'power2.in',
    force3D: true,
    overwrite: 'auto'
  })
}

/**
 * 不带动画地把抽屉置为关闭态（首次进入、切换断点时用）
 */
export function drawerSetClosed(el, mask) {
  if (el) gsap.set(el, { xPercent: -100, autoAlpha: 0 })
  if (mask) gsap.set(mask, { autoAlpha: 0 })
}

/**
 * 清除抽屉上的内联样式，恢复成桌面端常驻布局
 */
export function drawerReset(el, mask) {
  if (el) gsap.set(el, { clearProps: 'transform,opacity,visibility' })
  if (mask) gsap.set(mask, { autoAlpha: 0 })
}
