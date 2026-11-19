# MatBin Music Player 优化复盘

> 记录本轮性能优化与问题修复的全过程：现象、根因、解决方式，以及**下次如何避免**。
>
> 项目：Vue 3 + Vite + Pinia + GSAP + Tailwind，约 6500 行 / 37 个文件，纯 JS 无 TS。

---

## 一、总览

本轮共处理 **22 个问题**，分五类：

| 分类 | 数量 | 核心矛盾 |
| --- | --- | --- |
| 渲染与动画 | 6 | 昂贵 CSS 属性 + 未提层 + DOM 常驻 |
| 列表与数据规模 | 4 | 全量渲染 + 原图直出 |
| 播放时全局卡顿 | 3 | 高频状态污染持久化 |
| 交互与状态 | 8 | KeepAlive 生命周期 + 时序 |
| 工程化 | 1 | 无代码规范 |

关键数据：

| 指标 | 优化前 | 优化后 |
| --- | --- | --- |
| 500 首歌的 DOM 行数 | 500 | **17** |
| 持久化序列化体积 | 213KB / 20.79ms | **114KB** |
| element-plus chunk | 220KB | **116KB** |
| 歌单卡片封面单张 | 65.7KB | **15.5KB** |
| 首次切侧栏页面 | 等 chunk 下载 | **33ms** |
| 打开歌词页最长帧 | 100ms | **50ms** |
| 播放时滚动/切页 | 明显掉帧 | **p95 16.8ms，jank 0%** |
| ESLint 问题数 | 175（43 error） | **0** |

---

## 二、渲染与动画

### 2.1 移动端切页、歌词逐句动画掉帧

**现象**：手机上加 `blur` 的歌词行切换时明显卡顿。

**根因**：`filter: blur()` 是逐帧重算的高成本属性，元素又没有独立合成层，每帧都要重新栅格化。

**解决**：`.lyric-line` 加 `will-change: transform, opacity, filter`，GSAP 动画加 `force3D: true`。

**预防**：
- 动画只动 `transform` / `opacity`，避免 `filter`、`box-shadow`、`top/left/width/height`
- 动态效果确实需要 `filter` 时，给元素 `will-change`，且**动画结束要清掉**（常驻会吃显存）

---

### 2.2 页面级转场卡顿（`scale: 0 → 1`）

**现象**：音乐页进出时整屏掉帧。

**根因**：`scale` 作用在整个页面容器上，容器里包含完整表格，每帧重绘整页。

**解决**：动画期间设 `will-change: transform, opacity`，`onComplete` 里清空。

**预防**：**页面级位移动画不要把大列表包在动画元素里**。要么让动画作用于外层空壳，要么动画期间临时 `content-visibility: hidden` 内部内容。

---

### 2.3 抽屉开关卡顿

**现象**：移动端点侧栏按钮，抽屉滑出时有顿挫。

**根因**三个叠加：
1. 遮罩用 `v-if`，每次开关都重建 DOM → 重排
2. `xPercent` 动画没有 `force3D`，走的是 2D transform
3. 全高 64% 宽的面板每帧重绘

**解决**：
```css
/* 遮罩改常驻 */
<div v-show="isMobile" ...>
```
```js
gsap.fromTo(el, { xPercent: -100, autoAlpha: 0 },
  { xPercent: 0, autoAlpha: 1, force3D: true, ... })
```
```css
.sider-panel--drawer { will-change: transform, opacity; }
```

**预防**：
- 频繁开关的元素**用 `v-show` 不用 `v-if`**
- GSAP 位移动画一律加 `force3D: true`
- 大面板动画加 `will-change`

---

### 2.4 评论翻页卡顿

**现象**：点「换一批」评论，6 张卡片入场时卡一下。

**根因**：每张卡片内层都有 `backdrop-filter: blur(6px)`。6 个胶囊同时位移，浏览器每帧都要重新采样背景并做一次高斯模糊。

**解决**：动画期间给外层加类，临时关掉内层毛玻璃：
```js
for (const el of cells) el.classList.add('is-moving')
// ...GSAP 动画
onComplete: () => { for (const el of cells) el.classList.remove('is-moving') }
```
```css
.comment-cell.is-moving .comment-bubble { backdrop-filter: none; }
```

**预防**：
- **`backdrop-filter` 是性能黑名单第一位**，尤其配合位移/缩放时
- 需要毛玻璃的列表项，动画期间必须临时关闭
- 背景本身已经接近不透明（如 `rgba(20,20,40,0.94)`）时，`backdrop-filter` 纯属浪费，直接删

---

### 2.5 打开歌词页有 100ms 长任务

**现象**：首次点开歌词页，有一下明显停顿。

**根因**：`lyricPanel` 用 `v-show` 隐藏，意味着**几十行歌词 DOM 始终存在**，即使不显示也要参与布局。

**解决**：改 `v-if`，不切到滚动歌词模式就不渲染。
```html
<div v-if="isShowScrollLyrics" ref="lyc">
```

**预防**：**`v-show` 只用于频繁切换且 DOM 轻量的元素**。列表、面板这类「重量级但偶尔显示」的内容用 `v-if`。

---

### 2.6 两处无用的毛玻璃

**现象**：无（性能隐患，未表现为明显卡顿）。

**根因**：`音量/播放列表弹层` 和 `搜索历史下拉` 都写了 `backdrop-filter: blur(10px)`，但背景色分别是 `rgba(20,20,40,0.94)` 和 `rgba(26,26,48,0.96)`——94%/96% 不透明，模糊的只有剩下几个像素，视觉上完全看不出来。

**解决**：直接删掉两处 `backdrop-filter`。

**预防**：写毛玻璃前先问自己「背景是不是已经接近不透明」。是的话删掉，视觉无损、性能白赚。

---

## 三、列表与数据规模

### 3.1 `el-table` 几百行时滚动卡死

**现象**：搜索出 500 首歌，列表滚动像幻灯片。

**根因**：`el-table` 全量渲染。500 行 × 每行约 10 个节点 ≈ 5000+ DOM 节点，每帧都要参与布局。

**解决**：自己写 `virtualSongList.vue`，用 VueUse 的 `useVirtualList`：
- 只渲染可视区域 + 少量缓冲，**500 首只产生 17 行 DOM**
- 配合 `useInfiniteScroll` 做触底加载
- 表头/列宽/播放高亮/收藏按钮全部保留

**预防**：
- **超过 100 行的列表默认考虑虚拟滚动**
- 虚拟滚动的代价是**行高必须固定**，且不能有跨行合并；需求不满足时再考虑分页

---

### 3.2 空列表误弹「已经到底啦」

**现象**：第一次搜索、列表还没数据时就弹「已经到底啦」。

**根因**：`useInfiniteScroll` 把**空容器**判定为「已经在底部」→ 触发加载 → 加载函数发现列表为空，返回 `{ hasMore: false }` → 弹提示。

**解决**两层：
```js
// 组件层：没数据根本不触发
canLoad: () => props.songs.length > 0 && props.hasMore && !props.loading

// 页面层：空列表不算翻完了，返回 null 不提示
if (!state.playList?.length) return null
```

**预防**：
- 任何「滚动加载」都要区分**空状态**和**到底状态**
- 判断「到底」的依据是「返回条数 < 每页条数」或「服务端 total」，不是「滚动位置到顶」

---

### 3.3 element-plus 包体过大

**根因**：`main.js` 注册了 `ElTable`、`ElTableColumn`、`ElRow`、`ElCol`、`ElSlider`，其中表格相关占了 100KB+。

**解决**：换掉 `el-table` 后一并移除组件注册和 `el-table-infinite-scroll` 依赖。**220KB → 116KB（gzip 75 → 40KB）**。

**预防**：组件库用「按需引入」而不是全量 `app.use(ElementPlus)`；定期检查 `dist/assets` 里各 chunk 的体积。

---

### 3.4 歌单卡片拉原图

**根因**：`coverOf(item) = toHttps(item.picUrl)`，直接用了 500×500 原图，而卡片实际只有 200px 宽。

**解决**：`toThumb(toHttps(item.picUrl), 400)`。**单张 65.7KB → 15.5KB（-76%）**，24 张卡片总共省约 1.2MB。

**预防**：
- 所有远程图片按**实际显示尺寸 × 设备像素比**取缩略图
- 列表用小图、详情头图才用原图
- 顺手加 `loading="lazy"`

---

## 四、播放时的全局卡顿（最关键）

### 4.1 一播放，所有页面操作都卡

**现象**：播放中切页面、开抽屉、滚列表都掉帧；暂停后立刻丝滑。

**根因**（本轮最隐蔽的问题）：

```
audio.ontimeupdate（每 250ms）
  → this.currentMusicInfo.currentTime = audio.currentTime
    → currentTime 在被持久化的 pinia state 里
      → pinia 深层订阅被触发
        → JSON.stringify 整个 state（实测 213KB / 20.79ms）
          → 每秒 4 次，累计 83ms/秒 的主线程占用
```

`debouncedLocalStorage` 的 800ms 防抖只能减少**写磁盘**次数，**序列化在防抖之前就已经发生了**。

**解决**：

1. 把播放进度移出 pinia，放到 `src/utils/playProgress.js`：
```js
export const playProgress = ref(0)
```
`ontimeupdate` 改成写这个 ref，pinia 的订阅完全看不到它。

2. 持久化改 `paths` 白名单，排除 `playlistSongs`、`artistSongs` 这类刷新后会重新请求的大列表（**213KB → 114KB**）。

**预防**：
- **高频变化的字段（时间、滚动位置、鼠标坐标）永远不要放进会被持久化的 store**
- pinia 持久化用 `paths` 白名单而不是全量，否则任何字段变化都会触发全量序列化
- 判断依据：**这个字段每秒会变几次？** 超过 1 次就别放持久化 state

---

### 4.2 进度丢失，刷新后从头开始

**根因**：4.1 把进度移出 state 后，它变成纯内存值，刷新即归零。

**解决**：折中方案——**低频落盘**：
- `persistProgress(id, time)` 存到独立 key `music-play-progress`
- 保存时机：**暂停 / `pagehide` / `visibilitychange(hidden)`**
- 恢复时机：`initAudio` 里读，**按歌曲 id 匹配**，id 不同返回 0

**预防**：状态拆分时要想清楚「谁的持久化责任被转移了」，配套迁移读写路径。

---

### 4.3 切歌保存上一首进度（做了又删）

**背景**：最初在 `setMusicInfo` 开头加了「切走前保存上一首」。

**问题**：`readPersistedProgress` 只在刷新时调用一次，**没有任何地方会读这条记录**；更糟的是会造成数据污染：

```
听 A 到 88 秒 → 切 B（存 A:88）
→ 切回 A（从 0 播）→ 听 A 到 10 秒 → 刷新
→ 读到 A:88 → 跳到 88 秒  ✗
```

**解决**：删除该逻辑，只保留暂停和页面离开两个时机。

**预防**：
- **写存储前先确认「谁会读」**，没有读者就是死代码
- 带 id 的持久化记录要考虑「同一条记录被后续操作污染」的情况

---

## 五、交互与状态

### 5.1 切页回来滚动位置丢失

**现象**：`playList` 滚到中间 → 切到 `favorite` → 切回来，回到顶部。

**根因**：KeepAlive 缓存组件时会把 DOM 移出文档，元素脱离文档后浏览器把 `scrollTop` 清零。组件实例和 DOM 都还在，但滚动位置没了。

**解决**：组件内用生命周期钩子手动存取：
```js
let savedTop = 0
onDeactivated(() => { savedTop = container.ref.value?.scrollTop || 0 })
onActivated(() => {
  requestAnimationFrame(() => { container.ref.value.scrollTop = savedTop })
})
```
`requestAnimationFrame` 是必须的——`onActivated` 触发时虚拟列表还没算出总高度，直接赋值会被钳到 0。

**预防**：
- **任何被 KeepAlive 缓存的滚动容器都要显式处理 `onActivated` / `onDeactivated`**
- 不要指望浏览器「自动记住」滚动位置

---

### 5.2 热门歌单往返丢位置

**现象**：热门歌单滚动 → 进歌单详情 → 返回，回到顶部。

**根因**两个：
1. `getScroller()` 从自身 `parentElement` 向上找 `overflow-y: auto` 的祖先，但 `.hot-wrap` 自己加了 `position: absolute; overflow-y: auto` 后**自己就是滚动容器**，被跳过了
2. 恢复逻辑挂在 `onMounted`，而页面被 KeepAlive 缓存，返回时不重新挂载

**解决**：
```js
const getScroller = () => wrapRef.value   // 直接返回自身
```
```js
onMounted(loadData)
let activatedOnce = false
onActivated(() => {
  if (!activatedOnce) { activatedOnce = true; return }
  restoreScroll()   // 首次跳过，返回时才恢复
})
```

**预防**：
- 滚动容器变化时，**所有依赖「找最近滚动祖先」的代码都要重新确认**
- KeepAlive 下**所有「只在挂载时做一次」的逻辑都要判断是否需要 `onActivated`**

---

### 5.3 歌词面板切换失败

**现象**：点歌词区域想切换到滚动歌词，弹出「歌词面板切换失败」。

**根因**两个叠加：
1. `animateToHidden(target, duration, toScale, onComplete)` 需要 4 个参数，调用只传了 3 个 → 回调被当成 `toScale`，`onComplete` 是 `undefined` → **动画播完后状态切换的代码永远不执行**
2. `lyc` 改成 `v-if` 后初始为 `null`，函数开头的 `if (!lyc.value) return 报错` 直接拦下了

**解决**：改用原生 GSAP，参数一目了然，并等 DOM 渲染：
```js
gsap.to(AnimationLyric.value, {
  autoAlpha: 0, duration: 1.2, force3D: true,
  onComplete: async () => {
    isShowScrollLyrics.value = true
    await nextTick()                                   // ← 关键
    gsap.fromTo(lyc.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 })
  }
})
```

**预防**：
- **复用工具函数前先看签名**，参数位置错位是最难查的 bug 之一（不报错，只是行为静默失效）
- `v-if` 控制的元素，`await nextTick()` 之后再访问 ref
- 一个「工具函数」被多处复用时，考虑改成对象参数 `{ target, duration, onComplete }`

---

### 5.4 从主页回来歌词不定位

**现象**：歌词页滚到别处 → 回主页 → 再进来，没有回到当前播放的句子。

**根因**：
1. KeepAlive 下 `onMounted` 只执行一次，返回时不触发
2. 进场用的是 `scrollTo({ behavior: 'smooth' })`，会看到从顶部"滚一段"的动画，像卡了一下

**解决**：
```js
const lyricMove = (smooth = true) => {
  ...
  if (smooth) board.scrollTo({ top, behavior: 'smooth' })
  else board.scrollTop = top        // 进场直接落位
}

const relocate = () => setTimeout(() => lyricMove(false), 300)

onMounted(relocate)
onActivated(relocate)   // 从主页回来走这里
```

300ms 是等 `v-if` 渲染的列表高度稳定，否则 `offsetTop` 还是 0。

**预防**：
- **进场定位用瞬时跳转，播放中的跟随才用平滑滚动**
- 定位类操作要等布局稳定（`nextTick` / `requestAnimationFrame` / 固定延时）

---

### 5.5 `Cannot access 'resetLoadMore' before initialization`

**现象**：进入歌单详情直接报错，页面显示「该歌单暂无歌曲」。

**根因**：`const` 声明有变量提升但不初始化。
```js
watch(..., () => { resetLoadMore() }, { immediate: true })   // ← 立即执行
const { resetLoadMore } = useLoadMore(...)                    // ← 后声明，TDZ
```
`immediate: true` 让 watch 在 setup 阶段立刻跑，此时 `const` 还没初始化。

**解决**：把 `useLoadMore` 的解构移到 `watch` 之前。`artistSongs.vue` 有同样写法，一起修。

**预防**：
- **所有 `useXxx()` 的解构统一放在 setup 顶部**，在 `watch` / `onMounted` 之前
- 带 `immediate: true` 的 watch 要特别小心它依赖的变量声明顺序
- 这类错误 ESLint 默认规则抓不到，只能靠约定

---

### 5.6 侧栏首次点击很慢

**现象**：第一次点某个侧栏项要等一会儿才切过去，之后秒开。

**根因**：7 个路由全是 `() => import(...)` 懒加载。第一次点击要下载对应 chunk（15-24KB），下载完才能渲染；之后浏览器缓存了所以快。

**解决**：首屏渲染后立即预取全部页面：
```js
import('./pages/music/music.vue')
import('./pages/music/foundMusic.vue')
// ...共 7 个
```
实测首次切换 **33ms**（约两帧）。

**预防**：
- 懒加载的收益是首屏体积，代价是**首次导航延迟**
- 对「用户一定会去」的路由，用空闲/首屏后预取
- 可用 `<link rel="modulepreload">` 或动态 `import()` 预热

---

### 5.7 首屏背景图加载时点不进音乐

**现象**：刚打开网站，背景图还在加载时点「进入」，没反应。

**根因**：因果链比想象的长——
1. 根元素绑了 213KB / 1400×1400 的背景图
2. 图片解码（约 8MB 位图）占用主线程
3. 预取用的是 `requestIdleCallback`，**要等主线程空闲**
4. 解码期间不空闲 → 预取一直推迟
5. 用户点击时 `music` chunk 还没下 → 现下载 → 卡住

**解决**：
1. 预取改为「首屏渲染完立刻执行」，不等空闲
2. 背景图独立成层 + 淡入：
```html
<div class="bg-fade" :class="{ 'is-ready': bgReady }"
     :style="{ backgroundImage: `url(${defaultCover})` }"></div>
```
```css
.body { background-color: #14141f; isolation: isolate; }
.bg-fade { position: absolute; inset: 0; z-index: -1;
           opacity: 0; transition: opacity 0.5s ease; pointer-events: none; }
.bg-fade.is-ready { opacity: 1; }
```
```js
const bg = new Image()
bg.onload = () => { bgReady.value = true }
bg.src = defaultCover
```

**预防**：
- **`requestIdleCallback` 不是可靠的「尽快」**，主线程持续忙时它会一直不触发。关键资源预热要用确定的时机（`onMounted` / `router.isReady`）
- 首屏不该被一张装饰图阻塞
- 大图用独立图层 + `opacity` 淡入，而不是直接挂在容器背景上（`background-image` 无法过渡）

---

### 5.8 背景图变纯色看不见

**现象**：加了淡入图层后，本地只剩深色底，背景图消失。

**根因**：`z-index: -1` 逃出了父元素的层叠上下文。
```css
.body { position: relative; }   /* z-index: auto，不创建层叠上下文 */
.bg-fade { z-index: -1; }        /* 一路往上找到根元素，被 .body 背景色盖住 */
```

`position: relative` + `z-index: auto` **不构成层叠上下文**，负层级的子元素会继续往上找，最后跑到 `.body` 的 `background-color` 下面。

**解决**：
```css
.body { isolation: isolate; }
```

**预防**：
- **负 `z-index` 只在父元素有层叠上下文时才可靠**
- 创建层叠上下文的可靠方式：`isolation: isolate`、`z-index` 非 auto 的定位元素、`transform`、`opacity < 1`、`filter` 等
- 这类问题属性检查查不出来（`opacity: 1`、图片 URL 都对），**必须靠截图确认**

---

## 六、工程化

### 6.1 没有代码规范

**根因**：项目从未配置 lint，代码风格混乱（有的文件带分号有的不带）。

**解决**：
- ESLint 10 flat config + `eslint-plugin-vue` + Prettier
- `paths` 排除 `deploy/`（PM2 配置、网易云 API 补丁）和 `backup/`（原始项目备份）——这是排除掉 60+ 误报的关键
- 首次 **175 个问题（43 error + 132 warning）→ 0**
- `.vscode/settings.json` 配保存时自动格式化 + ESLint 修复

**预防**：
- 规范要在项目**开始时**就上，事后补会面对一次大 diff
- 忽略目录要先配好，否则第三方/部署代码的误报会淹没真实问题
- `--max-warnings 0` 可以作为 CI 门禁

---

## 七、经验与教训

### 7.1 两次判断错误的教训

**① 无头测试对 GPU 路径无效**

我用 CDP + `--disable-gpu` 做 `backdrop-filter` 开关的 A/B 对比，两边都是 `jank 0%`。原因是**软件渲染会跳过这些 GPU 路径**，测出来的数字没有参考价值。

→ **结论**：无头测试只能证明「没有主线程阻塞」，`backdrop-filter`、`filter`、合成层相关的真实开销必须真机验证。

**② Vite 开发模式下 `await import()` 拿到新模块实例**

我据此判断「进度恢复失败」，实际界面上进度条已正确显示 88 秒。HMR 会给模块 URL 加时间戳，动态 import 拿到的是另一个实例。

→ **结论**：验证 UI 状态时**读 DOM**（文本、截图），不要只读内部变量。

### 7.2 三个通用排查思路

1. **「停止 X 就变快」→ 找 X 触发的周期性任务**
   播放卡 → `timeupdate`；滚动卡 → 滚动事件里的重计算；动画卡 → 每帧重绘的属性。

2. **「首次慢、之后快」→ 找一次性缓存**
   chunk 下载、图片解码、字体加载、首次编译。

3. **「某个操作后全局变慢」→ 找全局副作用**
   store 被污染、事件监听未解绑、定时器未清理、层叠上下文被破坏。

### 7.3 预防清单（可直接贴进 Code Review）

**动画**
- [ ] 只动 `transform` / `opacity`
- [ ] GSAP 位移动画加 `force3D: true`
- [ ] 大元素动画加 `will-change`，结束后清除
- [ ] `backdrop-filter` 列表项在动画期间临时关闭
- [ ] 进场定位用瞬时跳转，不用 smooth

**状态**
- [ ] 每秒变多次的字段不进持久化 store
- [ ] pinia 持久化用 `paths` 白名单
- [ ] 带 id 的持久化记录，考虑后续操作是否会污染

**生命周期**
- [ ] KeepAlive 缓存页的滚动位置显式存取
- [ ] 「只在挂载做一次」的逻辑检查是否需要 `onActivated`
- [ ] `v-if` 元素的 ref 在 `nextTick` 后访问

**列表**
- [ ] 超过 100 行考虑虚拟滚动
- [ ] 区分「空状态」和「到底状态」

**资源**
- [ ] 远程图片按显示尺寸取缩略图
- [ ] 关键路由 chunk 预取
- [ ] 首屏不被装饰性大图阻塞

**代码**
- [ ] `useXxx()` 解构在 `watch` / `onMounted` 之前
- [ ] 复用工具函数前确认参数签名
- [ ] 负 `z-index` 的父元素有层叠上下文

---

## 八、附录

### 新增文件

| 文件 | 作用 |
| --- | --- |
| `src/pages/music/components/virtualSongList.vue` | 虚拟滚动列表，5 个页面共用 |
| `src/pages/music/components/listSkeleton.vue` | 列表骨架屏 |
| `src/utils/playProgress.js` | 播放进度（pinia 之外）+ 低频落盘 |
| `eslint.config.js` / `.prettierrc` / `.prettierignore` | 代码规范 |
| `.vscode/settings.json` / `extensions.json` | 编辑器保存时自动修复 |
| `scripts/e2e.mjs` | 9 条回归用例（含滚动位置记忆） |

### 常用命令

```bash
npm run dev        # 开发
npm run build      # 构建
npm run lint       # 检查
npm run lint:fix   # 自动修
npm run format     # 格式化
npm run test:e2e   # 回归测试
```

### 已删除

- `el-table-infinite-scroll` 依赖
- `gsapTools.js` 里的 `animateToHidden` / `animateToVisible`（参数签名有误且无人使用）
- `useTableStyle.js` 里的 5 个表格样式函数 + `formatArtists`
