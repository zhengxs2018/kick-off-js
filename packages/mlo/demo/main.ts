import { mlo, eventTarget, domTree } from '../src/index.js'

mlo.use(eventTarget)
mlo.use(domTree, {
  rules: [
    { type: 'starts', test: 'style', reason: '' },
    { type: 'starts', test: 'script', reason: '' },
    { type: 'starts', test: 'noscript', reason: '' },
  ],
})

let obj: object | null = { foo: 'bar' }

let objectRef = mlo.observe(obj)

console.log('Object reference created: %s', objectRef)

let event: EventTarget | null = new EventTarget()

event.addEventListener('test', function () {
  console.log('Event "test" triggered')
})

setInterval(() => {
  // 1. 解除对象的引用以获取其值
  obj = null
  event = null
}, 4000)

setInterval(() => {
  console.dir(mlo.toJSON(), {
    depth: Number.MAX_SAFE_INTEGER,
  })
}, 2000)
