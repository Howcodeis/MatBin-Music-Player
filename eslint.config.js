import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default [
  // deploy 下是 PM2 配置和网易云 API 的补丁脚本，backup 是原始项目备份，都不是应用源码
  { ignores: ['dist/**', 'node_modules/**', 'deploy/**', 'backup/**'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    rules: {
      // 组件名不是多单词（controls / soloPage / MusicLayout 之外还有大量单词名）
      'vue/multi-word-component-names': 'off',
      // 未使用的变量先给警告，方便边改边清
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      // 属性太多时强制换行会跟 Prettier 打架
      'vue/max-attributes-per-line': 'off',
      'vue/html-self-closing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/require-default-prop': 'off'
    }
  },
  {
    // 构建配置和测试脚本跑在 Node 里，process / module 这些是合法的
    files: ['*.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  prettier
]
