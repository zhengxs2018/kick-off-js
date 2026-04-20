import {
  mlo,
  eventTarget,
  promises,
  NativeSetInterval,
  NativeSetTimeout,
} from '../../src/index.js'

mlo.use(promises)
mlo.use(eventTarget)

let obj: object | null = { foo: 'bar' }

let objectRef = mlo.observe(obj)

console.log('Object reference created: %s', objectRef)

class Foo extends EventTarget {}

let event: EventTarget | null = new Foo()

event.addEventListener('test', function () {
  console.log('Event "test" triggered')
})

let promise: Promise<unknown> | null = new Promise((resolve) => {
  NativeSetTimeout(() => {
    resolve('Hello, MLO!')
  }, 10000)
})

NativeSetInterval(() => {
  // 1. 解除对象的引用以获取其值
  obj = null
  event = null
  promise = null
}, 4000)

NativeSetInterval(() => {
  console.dir(mlo.toJSON(), {
    depth: Number.MAX_SAFE_INTEGER,
  })
}, 2000)
