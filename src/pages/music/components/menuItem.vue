<script setup>
import { defineOptions } from 'vue';

defineOptions({
  name: 'MenuItem'
})

defineProps({
  // 路由名
  title: {
    type: String,
    default: 'playList'
  },
  // 展示文案，缺省时回退到路由名
  label: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <router-link class="routerStyle" :to="{ name: title }">
    <p>
      {{ label || title }}
    </p>
  </router-link>
</template>

<style scoped>
.routerStyle {
  display: block;
  position: relative;
}

.routerStyle p {
  position: relative;
  z-index: 1;
  padding: 0 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.25s ease;
}

/* 用内缩的圆角底色代替原来的 blur 滤镜，浅色背景上不会再糊成一团 */
.routerStyle::before {
  content: '';
  position: absolute;
  inset: 0.2rem 0.5rem;
  border-radius: 10px;
  background: transparent;
  transition: background 0.25s ease;
}

.routerStyle:hover::before {
  background: rgba(255, 255, 255, 0.14);
}

.routerStyle:hover p {
  color: #ffffff;
}

.routerStyle.router-link-active::before {
  background: rgba(124, 152, 208, 0.6);
}

.routerStyle.router-link-active p {
  color: #ffffff;
  font-weight: 600;
}
</style>
