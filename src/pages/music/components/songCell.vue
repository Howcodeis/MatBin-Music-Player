<script setup>
/* 各列表共用的歌曲行；封面兼容 al.picUrl / album.picUrl / cover，缺失或加载失败回退默认图 */
import { computed, ref, watch } from 'vue'
import defaultCover from '@/assets/image/109951173012411790.jpg'
import { toThumb } from '@/utils/music'

const props = defineProps({
  song: {
    type: Object,
    default: () => ({})
  },
  // 封面边长（px），桌面端和窄屏由调用方分别传
  coverSize: {
    type: Number,
    default: 38
  }
})

// 图片加载失败标记：换歌/换行数据时重置
const failed = ref(false)

const src = computed(() => {
  const song = props.song || {}
  const raw = song.al?.picUrl || song.album?.picUrl || song.cover || ''
  // /cloudsearch 的图床地址是 http://，https 部署会被浏览器当混合内容拦掉；
  // 网易云同一个路径 https 也能访问，这里统一升级。行内只显示 40px，取 80 的缩略图够清晰。
  return toThumb(raw.replace(/^http:\/\//i, 'https://'), 80)
})

const finalSrc = computed(() => (failed.value || !src.value ? defaultCover : src.value))

// el-table 会复用行组件，song 变了要把失败标记复位，否则新歌也会一直显示默认图
watch(src, () => {
  failed.value = false
})
</script>

<template>
  <div class="song-cell">
    <img
      class="song-cover"
      :src="finalSrc"
      :style="{ width: coverSize + 'px', height: coverSize + 'px' }"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <div class="song-meta">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.song-cell {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  min-width: 0;
}

.song-cover {
  flex: 0 0 auto;
  object-fit: cover;
  border-radius: 0.375rem;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
}

/* 文字区必须能收缩，否则长歌名会把封面挤出去 */
.song-meta {
  flex: 1;
  min-width: 0;
}
</style>
