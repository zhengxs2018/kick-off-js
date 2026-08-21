# @zhengxs/mlo

一个对象观察与 DOM 监控工具，用于辅助页面排查是否存在内存泄漏。

## 特性

- **插件化架构**：支持灵活扩展，内置多种插件（DOM 树、事件、定时器、Vue2 组件等）。
- **对象引用追踪**：通过 `FinalizationRegistry` 和 `WeakRef` 追踪对象的生命周期与依赖关系。
- **事件系统**：内置轻量事件机制，支持对象、元素等多种事件监听与分发。
- **DOM 变动与属性观察**：可选开启 MutationObserver、ResizeObserver 等，自动追踪 DOM 变化。
- **Vue2 支持**：自动关联 Vue2 组件与 DOM 元素，便于调试和可视化。
- **类型安全**：TypeScript 全量类型定义，开发体验优秀。

### 使用场景

- 前端调试工具开发
- 可视化编辑器/低代码平台
- 复杂页面对象依赖追踪
- 插件式架构扩展

### 插件

- `domTree`：监控 DOM 树结构变化
- `eventTarget`：增强事件监听追踪
- `observers`：DOM 变动与尺寸观察
- `timers`：定时器追踪
- `vue2`：Vue2 组件与 DOM 关联

## 示例

```ts
import { mlo, eventTarget, domTree, observers } from '@zhengxs/mlo';

mlo.use(eventTarget);
mlo.use(observers, {
  // 监控 ResizeObserver 对象
  resize: true,
  // 监控 MutationObserver 对象
  mutation: true,
});
mlo.use(domTree, {
  // 立即递归查找一次页面中的所有可见元素
  scan: true,
  // 通过 MutationObserver 持续监控页面
  monitor: true,
});

mlo.events.onObjectObserved(event => {
  console.log('新增观察对象: %s', event.detail);
});

mlo.events.onObjectCollected(event => {
  console.log('对象已被回收: %s', event.detail);
});

let obj: object | null = { foo: 'bar' };

// 观察对象
mlo.observe(obj);

let func = () => void 0;

// 观察函数
mlo.observe(func);

let button = document.querySelector('#test');

// 观察 DOM 元素
mlb.observe(button);

// 通过 eventTarget 插件自动监控
let event: EventTarget | null = new EventTarget();

event.addEventListener('test', function () {
  console.log('Event "test" triggered');
});

setInterval(() => {
  obj = null;
  event = null;
  func = null;
  button = null;
}, 4000);

// 输出统计数据
console.log(mlo.toJSON());
```

## License

MIT
