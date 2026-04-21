import { mlo, NativeSetTimeout } from '@zhengxs/mlo'

let obj: object | null = { foo: 'bar' }

mlo.observe(obj)

class Foo extends EventTarget { }

let event: EventTarget | null = new Foo()

event.addEventListener('test', function () {
  console.log('Event "test" triggered')
})

let promise: Promise<unknown> | null = new Promise((resolve) => {
  NativeSetTimeout(() => {
    resolve('Hello, MLO!')
    promise = null
  }, 10000)
})

NativeSetTimeout(() => {
  obj = null
  event = null
}, 10000)
