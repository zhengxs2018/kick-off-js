import * as shared from '@zhengxs/shared'

import './polyfill.js'
import { createRequireContext, Script } from '../src/index.js'

const code = `
  const { isNill } = require('@zhengxs/shared')

  const msg = 'hello,sandbox'

  exports.print = function () {
    console.clear()
    console.log('NODE_ENV', process.env.NODE_ENV)
    console.log('上下文变量：', 'hello,sandbox')
  }
`
const vm = new Script(code, {
  inject: ['module', 'exports', 'require', 'process'],
})

// 模拟 commonjs 上下文
const context = createRequireContext({
  process: {
    env: {
      NODE_ENV: 'development',
    },
  },
  require: (id: string) => {
    if (id === '@zhengxs/shared') {
      return shared
    }

    throw new Error(`Cannot find module '${id}'`)
  },
})

vm.runInContext(context)

// 调用内部函数
context.module.print()
