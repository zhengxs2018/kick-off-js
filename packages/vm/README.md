# @zhengxs/vm

基于 Proxy 的浏览器沙箱，确保动态运行的代码，不会污染全局环境。

## 使用

```ts
import { runInNewContext } from '@zhengxs/vm';

window.globalVar = 3;

const context = {
  globalVar: 1,
};

runInNewContext('globalVar *= 2', context);

console.log(context);
// Prints: { globalVar: 2 }

console.log(window.globalVar);
// Prints: 3
```

## License

MIT
