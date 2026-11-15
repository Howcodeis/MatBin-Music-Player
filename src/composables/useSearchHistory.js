/*
 * @Author: Matbin
 * @Date: 2026-11-13
 * @Description: 搜索历史（localStorage 持久化）
 *
 * 用模块级单例：多个地方调用 useSearchHistory() 拿到的是同一份数据，
 * 不会出现某个组件改了、另一个组件还显示旧列表的情况。
 */
import { ref } from 'vue'

const STORAGE_KEY = 'music-search-history'
const MAX_ITEMS = 10

// 读的时候做一次清洗，防止手工改坏 localStorage 导致渲染异常
const readHistory = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter(item => typeof item === 'string' && item.trim())
      .map(item => item.trim())
      .slice(0, MAX_ITEMS)
  } catch (error) {
    return []
  }
}

const history = ref(readHistory())

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value))
  } catch (error) {
    // 隐私模式或配额满时静默失败，不影响搜索本身
    console.warn('[search-history] 保存失败:', error?.message)
  }
}

/**
 * 记录一次搜索
 * 大小写不敏感去重，最近搜的排最前，超出上限的截断
 * @param {string} keyword
 */
export const addSearchHistory = (keyword) => {
  const value = String(keyword ?? '').trim()
  if (!value) return
  const rest = history.value.filter(item => item.toLowerCase() !== value.toLowerCase())
  history.value = [value, ...rest].slice(0, MAX_ITEMS)
  persist()
}

/**
 * 删除一条记录
 * @param {string} keyword
 */
export const removeSearchHistory = (keyword) => {
  history.value = history.value.filter(item => item !== keyword)
  persist()
}

/** 清空全部记录 */
export const clearSearchHistory = () => {
  history.value = []
  persist()
}

/**
 * 组件里使用搜索历史
 * @returns {{ history: import('vue').Ref<string[]> }}
 */
export function useSearchHistory () {
  return { history }
}
