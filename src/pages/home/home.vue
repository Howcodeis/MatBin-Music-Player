<script setup>
import { defineOptions } from 'vue';

defineOptions({
  name: 'Home'
})
</script>

<template>
  <div class="container flex flex-col items-center justify-center h-full text-blue-300">
    <p class="text-2xl tracking-widest">Matbin Music</p><br>
    <p>流年辗转，岁月长河慢慢流逝，如果给你一架时光机，你会让它载你到何方？ 重温无忧无虑的童年时光？</p>
    <p> 那时的情绪单纯 因为父母一句夸奖开心一上午 因为作业没得优秀难过一整天</p>
    <p> 那时的娱乐简易 放学后捉迷藏怎么也玩不够
      周末挖沙坑捏泥人不尽乐趣 惬意、有趣、无烦忧 回顾脸红心跳的叛逆青春期？</p>
    <p> 那时的感情真挚 不用考虑对方家境如何 不用在乎对方成绩优良</p>
    <p> 那时怀揣懵懂 一个眼神乱了阵脚 一纸情书慌了心跳 青涩、悸动、小美好
      还是回到那个长辈们健在的冬天？</p>
    <p>那时他们身体无恙 偶尔与爷爷浇花种草 偶尔与奶奶聊聊理想 偶尔和外公喝茶下棋 偶尔和外婆做饭洗碗</p>
    <p> 那时以为时间还多</p>
    <p> 那时觉得日子还长 无奈、悔恨、思念荒 </p>
    <p>其实 每个人都有自己的遗憾</p>
    <p>
      回到什么年纪都好 因为现在懂得比以前多 也许可以做的比过去好 但是 人生没有那么多如果 望你能渡好当下时光 也幸亏人生没有如果 梦醒时 依然可以保持努力 风雨人生里 简单最快乐
    </p><br>
    <p>
      为了让你在音乐的世界里找到属于自己的时光机 我们为你准备了一个小小的音乐播放器
    </p><br>
    <router-link class="cta" :to="{ name: 'music' }">Let's find a time machine for music!</router-link>
  </div>
</template>

<style scoped>
.container {
  /* 和音乐页一样用绝对定位铺满，路由过渡时两页共存才能交叉淡变 */
  position: absolute;
  width: 100%;
}

.cta {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 1.5rem;
  border: 1px solid rgb(147 197 253 / 0.45);
  border-radius: 9999px;
  background: rgb(147 197 253 / 0.1);
  color: rgb(191 219 254);
  font-size: 0.9rem;
  transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
}

.cta:hover {
  background: rgb(147 197 253 / 0.22);
  border-color: rgb(147 197 253 / 0.8);
  transform: translateY(-2px);
}

@media (max-width: 639.98px) {
  .cta {
    font-size: 0.8rem;
    padding: 0.5rem 1.2rem;
  }
}
</style>
