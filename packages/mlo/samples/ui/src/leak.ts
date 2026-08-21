import { mlo, NativeSetTimeout } from '@zhengxs/mlo';

let obj: object | null;
let promise: Promise<unknown> | null;
let event: EventTarget | null;

export function createMemoryLeak() {
  obj = { foo: 'bar' };

  mlo.observe(obj);

  class Foo extends EventTarget {}

  event = new Foo();

  event.addEventListener('test', function () {
    console.log('Event "test" triggered');
  });

  promise = new Promise(resolve => {
    NativeSetTimeout(() => {
      resolve('Hello, MLO!');
      promise = null;
    }, 10000);
  });

  NativeSetTimeout(() => {
    // 1. 解除对象的引用以获取其值
    obj = null;
    event = null;
  }, 4000);
}
