/*
 * 搜索历史（localStorage 持久化）。
 * 用 VueUse 的 useStorage，读写自动同步，模块级单例保证多处调用拿到同一份数据。
 */
import { useStorage } from '@vueuse/core'

const MAX_ITEMS = 10

const history = useStorage('music-search-history', [])

// 读出来先清洗一次，防止手工改坏 localStorage 导致渲染异常
if (Array.isArray(history.value)) {
  history.value = history.value
    .filter(item => typeof item === 'string' && item.trim())
    .map(item => item.trim())
    .slice(0, MAX_ITEMS)
} else {
  history.value = []
}

/**
 * 记录一次搜索
 * 大小写不敏感去重，最近搜的排最前，超出上限的截断
 * @param {string} keyword
 */
export const addSearchHistory = keyword => {
  const value = String(keyword ?? '').trim()
  if (!value) return
  const rest = history.value.filter(item => item.toLowerCase() !== value.toLowerCase())
  history.value = [value, ...rest].slice(0, MAX_ITEMS)
}

/**
 * 删除一条记录
 * @param {string} keyword
 */
export const removeSearchHistory = keyword => {
  history.value = history.value.filter(item => item !== keyword)
}

/** 清空全部记录 */
export const clearSearchHistory = () => {
  history.value = []
}

/**
 * 组件里使用搜索历史
 * @returns {{ history: import('vue').Ref<string[]> }}
 */
export function useSearchHistory() {
  return { history }
}
