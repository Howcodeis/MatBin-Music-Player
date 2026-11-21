<script setup>
/* 可点击的歌手名；@click.stop 防止冒泡到行的播放事件 */
import { computed, defineOptions } from 'vue'
import { useGoArtist } from '@/composables/useGoArtist'

defineOptions({
  name: 'ArtistLinks'
})

const props = defineProps({
  artists: {
    type: [Array, String],
    default: () => []
  },
  separator: {
    type: String,
    default: ' / '
  },
  emptyText: {
    type: String,
    default: '暂无歌手'
  }
})

const list = computed(() => (Array.isArray(props.artists) ? props.artists : []))
const { goArtist } = useGoArtist()
</script>

<template>
  <span class="artist-links">
    <template v-if="list.length">
      <template v-for="(artist, index) in list" :key="artist.id ?? index">
        <span v-if="index" class="artist-sep">{{ separator }}</span>
        <span
          class="artist-link"
          :title="`查看 ${artist.name} 的热门歌曲`"
          @click.stop="goArtist(artist)"
        >
          {{ artist.name }}
        </span>
      </template>
    </template>
    <span v-else class="artist-empty">{{ emptyText }}</span>
  </span>
</template>

<style scoped>
.artist-links {
  display: inline;
}

.artist-link {
  cursor: pointer;
  transition: color 0.18s ease;
}

.artist-link:hover {
  color: #99ccff;
  text-decoration: underline;
}

.artist-sep {
  opacity: 0.65;
}

.artist-empty {
  opacity: 0.65;
}
</style>
