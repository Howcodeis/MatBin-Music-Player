// tailwind.config.js
module.exports = {
  // purge: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  // darkMode: false, // or 'media' or 'class'
  // prefix: ,
  content: [
    './public/**/*.html',
    './src/**/*.{js,jsx,ts,tsx,vue}',
  ],
  theme: {
    extend: {},
  },
  /*
   * 让所有 hover: 工具类自动包一层 @media (hover: hover)。
   * 触屏上 :hover 触发后会一直保持，点完按钮颜色/缩放卡住不还原，
   * 开了这个之后移动端不再生成 hover 样式，视觉状态只由业务状态决定。
   */
  future: {
    hoverOnlyWhenSupported: true,
  },
  variants: {
    extend: {},
  },
  plugins: [],
}