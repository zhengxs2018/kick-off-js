// 测试环境装配：为每个测试注入干净的 Bun 原生 window 伪装对象，避免跨测试监听泄漏。
//
// 为何用 Bun 原生 EventTarget 而非 jsdom window：web.ts 内部的 AbortController 来自 Bun 原生，
// 其 signal 传给 window.addEventListener 的 options 时，jsdom 会校验 signal 必须为 jsdom 的
// AbortSignal 实例而抛错。Bun EventTarget 与 Bun AbortController 同源，规避该冲突。
//
// 每个测试重建 window，确保 start() 注册的 message 监听不跨测试累积。
import { afterEach, beforeEach } from 'bun:test';

type FakeWindow = EventTarget & {
  postMessage(message: unknown, targetOrigin: string, transfer?: Transferable[]): void;
};

let fakeWindow: FakeWindow | null = null;

class FakeWindowImpl extends EventTarget {
  postMessage(_message: unknown, _targetOrigin: string, _transfer?: Transferable[]): void {
    // 真实 Window.postMessage 行为由测试侧通过 mock source 模拟；此处为签名占位。
  }
}

beforeEach(() => {
  fakeWindow = new FakeWindowImpl() as FakeWindow;
  (globalThis as Record<string, unknown>).window = fakeWindow;
});

afterEach(() => {
  fakeWindow = null;
  delete (globalThis as Record<string, unknown>).window;
});

export function getWindow(): FakeWindow {
  return (globalThis as Record<string, unknown>).window as FakeWindow;
}
