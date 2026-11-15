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
import { ElTable, ElTableColumn, ElSlider, ElRow, ElCol } from 'element-plus'
import ElTableInfiniteScroll from 'el-table-infinite-scroll'
import 'element-plus/dist/index.css'
import './assets/index.css'
import './assets/iconfont.css'


const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)

// 模板里只用到这 5 个组件，逐个注册即可被 tree-shaking 掉其余部分
const components = [ElTable, ElTableColumn, ElSlider, ElRow, ElCol]
components.forEach(component => app.component(component.name, component))

app
  .use(pinia)
  .use(router)
  .use(ElTableInfiniteScroll)
  .mount('#app')
