import { ref } from 'vue'

/*
 * 播放进度。
 *
 * 单独放在 pinia 外面是有原因的：它每 250ms 变一次，
 * 放在持久化的 store 里会触发 pinia 的深度订阅 + 整个 state 的 JSON 序列化，
 * 播放时所有动画都跟着卡。
 */
export const playProgress = ref(0)
