/*
 * @Author: Matbin
 * @Date: 2023-11-21 13:51:04
 * @Description: 入口配置
 */

import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import router from './router'
// 按需注册：整包引入 element-plus 会把全部组件打进 bundle（约 840KB）
import { ElSlider } from 'element-plus'
import 'element-plus/dist/index.css'
import './assets/index.css'
import './assets/iconfont.css'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)

// 模板里只剩进度条用到 Element Plus 组件
const components = [ElSlider]
components.forEach(component => app.component(component.name, component))

app.use(pinia).use(router).mount('#app')
