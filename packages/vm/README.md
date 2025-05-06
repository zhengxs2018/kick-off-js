# @zhengxs/vm

> 🧪 未发布

在浏览器中运行的 JS 沙箱

## 使用

```ts
import { createRequireContext, Script } from '@zhengxs/vm'

const code = `
  exports.print = function () {
    console.log('上下文变量：', 'hello,sandbox')
  }
`

const vm = new Script(code, {
  inject: ['module', 'exports'],
})

// 模拟 commonjs 上下文
const context = createRequireContext()

// 执行上下文
vm.runInContext(context)

// 调用内部导出的函数
context.module.print()
```

## License

MIT
