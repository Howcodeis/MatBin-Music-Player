<script setup>
/* 加载占位；行高对齐真实列表，切换时不跳动 */
defineOptions({
  name: 'ListSkeleton'
})

defineProps({
  rows: { type: Number, default: 8 }
})
</script>

<template>
  <div class="skeleton">
    <div v-for="i in rows" :key="i" class="skeleton-row">
      <span class="skeleton-cover" />
      <span class="skeleton-lines">
        <span class="skeleton-line" style="width: 46%" />
        <span class="skeleton-line skeleton-line--sub" style="width: 26%" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.skeleton {
  width: 100%;
  padding: 0.25rem 0;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 60px;
  padding-left: 0.9rem;
}

@media (max-width: 767.98px) {
  .skeleton-row {
    height: 52px;
  }
}

.skeleton-cover,
.skeleton-line {
  display: block;
  border-radius: 0.35rem;
  /* 扫光动画比纯灰块更能说明「正在加载」 */
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.08) 25%,
    rgba(255, 255, 255, 0.16) 37%,
    rgba(255, 255, 255, 0.08) 63%
  );
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
}

.skeleton-cover {
  width: 38px;
  height: 38px;
  flex: none;
}

@media (max-width: 767.98px) {
  .skeleton-cover {
    width: 30px;
    height: 30px;
  }
}

.skeleton-lines {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex: 1;
  min-width: 0;
}

.skeleton-line {
  height: 0.7rem;
}

.skeleton-line--sub {
  height: 0.55rem;
  opacity: 0.7;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>
