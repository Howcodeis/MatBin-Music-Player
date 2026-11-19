<script setup>
import { defineOptions } from 'vue'

defineOptions({
  name: 'Home'
})
</script>

<template>
  <div class="container">
    <!-- 流动色背景：只做 transform 平移，走合成层，不触发重绘 -->
    <div class="aurora" aria-hidden="true"></div>

    <div class="inner">
      <header class="hero">
        <p class="brand">Matbin Music</p>
        <!-- 引子文案暂时隐藏，要恢复把下面这段放开
        <p class="lead">流年辗转，岁月长河慢慢流逝。如果给你一架时光机，你会让它载你到何方？</p>
        -->
      </header>

      <!-- 三个分章 + 转折句暂时隐藏，要恢复把这一整段放开
      <section class="chapter">
        <h2>重温无忧无虑的童年时光？</h2>
        <p>那时的情绪单纯：因为父母一句夸奖开心一上午，因为作业没得优秀难过一整天。</p>
        <p>
          那时的娱乐简易：放学后捉迷藏怎么也玩不够，周末挖沙坑捏泥人不尽乐趣。惬意、有趣、无烦忧。
        </p>
      </section>

      <section class="chapter">
        <h2>回顾脸红心跳的叛逆青春期？</h2>
        <p>那时的感情真挚：不用考虑对方家境如何，不用在乎对方成绩优良。</p>
        <p>那时怀揣懵懂：一个眼神乱了阵脚，一纸情书慌了心跳。青涩、悸动、小美好。</p>
      </section>

      <section class="chapter">
        <h2>还是回到那个长辈们健在的冬天？</h2>
        <p>
          那时他们身体无恙：偶尔与爷爷浇花种草，偶尔与奶奶聊聊理想，偶尔和外公喝茶下棋，偶尔和外婆做饭洗碗。
        </p>
        <p>那时以为时间还多，那时觉得日子还长。无奈、悔恨、思念荒。</p>
      </section>

      <p class="pivot">其实，每个人都有自己的遗憾。</p>

      <section class="chapter closing">
        <p>回到什么年纪都好。因为现在懂得比以前多，也许可以做得比过去好。</p>
        <p>
          但是，人生没有那么多如果——望你能渡好当下时光；也幸亏人生没有如果，梦醒时依然可以保持努力。风雨人生里，简单最快乐。
        </p>
      </section>
      -->

      <footer class="outro">
        <!-- 说明文案暂时隐藏，要恢复把下面这段放开
        <p>为了让你在音乐的世界里找到属于自己的时光机，我们为你准备了一个小小的音乐播放器。</p>
        -->
        <router-link class="cta" :to="{ name: 'music' }">
          Let's find a time machine for music!
        </router-link>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/*
 * 布局：引子 + 三个分章 + 转折 + 结尾。
 * 根元素保持 position:absolute —— App.vue 的路由过渡是两页交叉淡变，
 * 两个页面必须绝对定位重叠，否则会互相挤开。
 */
.container {
  position: relative;
  inset: 0;
  width: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  /*
   * 背景是彩色花卉 + 天空，App.vue 那层 50% 黑遮罩压不住长文的对比度。
   * 这里再叠一层，只影响这一页，不动全局。
   * 主页改纯色后不再需要，要恢复长文时再放开
   * background: rgba(3, 8, 18, 0.44);
   */
  /* 内容不满一屏时居中，超出时从顶部开始滚 —— margin:auto 的经典用法，
     比 justify-content:center 更稳（后者在内容溢出时会把顶部裁掉） */
  display: flex;
}

.inner {
  position: relative;
  z-index: 1;
  margin: auto;
  width: 100%;
  max-width: 40rem;
  padding: 3.5rem 1.5rem 4rem;
  color: rgb(191 219 254);
  /* 只留标题和按钮，整体居中 */
  text-align: center;
}

/*
 * 流动色：一块比屏幕大很多的渐变，整体缓慢平移 + 轻微缩放。
 * 关键是只动 transform —— 渐变本身是静态的，浏览器只做图层合成，
 * 不用每帧重新栅格化（改 background-position 就会，全屏重绘很贵）。
 * 颜色都压了透明度，整体偏暗，不抢标题的注意力。
 */
.aurora {
  position: fixed;
  inset: -20%;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(45% 50% at 24% 26%, rgba(104, 86, 214, 0.62), transparent 62%),
    radial-gradient(50% 48% at 76% 56%, rgba(38, 116, 190, 0.55), transparent 62%),
    radial-gradient(44% 46% at 52% 86%, rgba(150, 62, 138, 0.46), transparent 62%),
    linear-gradient(158deg, #12121f 0%, #17172e 48%, #0f1119 100%);
  will-change: transform;
  animation: aurora-drift 34s ease-in-out infinite alternate;
}

@keyframes aurora-drift {
  0% {
    transform: translate3d(-3%, -2%, 0) scale(1);
  }

  50% {
    transform: translate3d(2%, 3%, 0) scale(1.07);
  }

  100% {
    transform: translate3d(3%, -3%, 0) scale(1.04);
  }
}

/* 系统开了「减少动态效果」就不动 */
@media (prefers-reduced-motion: reduce) {
  .aurora {
    animation: none;
  }
}

/* ---------------- 标题区 ---------------- */
.brand {
  font-size: 1.75rem;
  letter-spacing: 0.32em;
  color: #ffffff;
  margin-bottom: 1.4rem;
  text-shadow: 0 2px 10px rgb(0 0 0 / 0.6);
  /* 字间距会在末字右侧留白，补等量的左缩进，居中才真的居中 */
  padding-left: 0.32em;
}

.lead {
  font-size: 1.02rem;
  line-height: 2;
  color: rgb(240 245 252 / 0.97);
}

/* ---------------- 分章 ---------------- */
.chapter {
  position: relative;
  margin-top: 2.2rem;
  padding-left: 1.1rem;
  border-left: 1px solid rgb(147 197 253 / 0.32);
}

.chapter h2 {
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: #bfe0ff;
  margin-bottom: 0.65rem;
}

.chapter p {
  font-size: 0.95rem;
  line-height: 2;
  color: rgb(232 239 250 / 0.94);
}

.chapter p+p {
  margin-top: 0.55rem;
}

.closing {
  border-left-color: rgb(147 197 253 / 0.55);
}

/* 转折句：独立成行，比正文重一点 */
.pivot {
  margin-top: 2.4rem;
  padding-left: 1.1rem;
  font-size: 1.05rem;
  letter-spacing: 0.06em;
  color: #ffffff;
}

/* ---------------- 结尾与按钮 ---------------- */
.outro {
  margin-top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
}

.outro p {
  font-size: 0.92rem;
  line-height: 1.95;
  color: rgb(226 235 247 / 0.9);
}

.cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 1.5rem;
  border: 1px solid rgb(147 197 253 / 0.45);
  border-radius: 9999px;
  background: rgb(147 197 253 / 0.1);
  color: rgb(191 219 254);
  font-size: 0.9rem;
  transition:
    background 0.25s ease,
    border-color 0.25s ease,
    transform 0.25s ease;
}

/* 触屏上 :hover 会粘住，只在真正支持悬停的设备上做位移反馈 */
@media (hover: hover) and (pointer: fine) {
  .cta:hover {
    background: rgb(147 197 253 / 0.22);
    border-color: rgb(147 197 253 / 0.8);
    transform: translateY(-2px);
  }
}

/* ---------------- 窄屏 ---------------- */
@media (max-width: 639.98px) {
  .inner {
    padding: 2.5rem 1.15rem 3rem;
    max-width: 100%;
  }

  .brand {
    font-size: 1.4rem;
    letter-spacing: 0.26em;
    margin-bottom: 1.05rem;
  }

  .lead {
    font-size: 0.92rem;
    line-height: 1.95;
  }

  .chapter {
    margin-top: 1.8rem;
    padding-left: 0.9rem;
  }

  .chapter h2 {
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  .chapter p {
    font-size: 0.88rem;
    line-height: 1.95;
  }

  .pivot {
    margin-top: 2rem;
    padding-left: 0.9rem;
    font-size: 0.96rem;
  }

  .outro {
    margin-top: 2rem;
    gap: 0.9rem;
  }

  .outro p {
    font-size: 0.86rem;
  }

  .cta {
    font-size: 0.8rem;
    padding: 0.5rem 1.2rem;
  }
}
</style>
