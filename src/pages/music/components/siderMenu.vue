<script setup>
import { computed, defineOptions } from 'vue'
import { useRouter } from 'vue-router'
import menuItem from './menuItem.vue'

defineOptions({
  name: 'SiderMenu'
})

// 只保留真实存在的路由名；显示文案直接取路由 meta.menu，避免再维护一份硬编码
const router = useRouter()
const MENU_NAMES = ['home', 'playList', 'favorite', 'foundMusic', 'hotPlayList', 'charts']

const menus = computed(() => {
  const records = router.getRoutes()
  return MENU_NAMES.map(name => {
    const record = records.find(item => item.name === name)
    return { name, label: record?.meta?.menu || name }
  })
})
</script>

<template>
  <ul
    class="flex flex-col items-center justify-center w-full h-full text-center leading-10 overflow-scroll"
  >
    <li v-for="item in menus" :key="item.name" class="li-style">
      <menuItem :title="item.name" :label="item.label" />
    </li>
  </ul>
</template>

<style scoped>
.li-style {
  @apply relative w-full mb-2 select-none;
}
</style>
