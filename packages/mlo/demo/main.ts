import {
  mlo,
  timers,
  domTree,
  eventTarget,
  observers,
  vue2,
} from '../src/index.js'

mlo.use(domTree)
mlo.use(eventTarget)
mlo.use(observers)
mlo.use(timers, {
  interval: { time: 1000 },
})
mlo.use(vue2)

mlo.events.onObjectObserved((event) => {
  console.log('Object observed: %s', event.detail)
})

mlo.events.onObjectUnobserved((event) => {
  console.log('Object unobserved: %s', event.detail)
})

mlo.events.onObjectCollected((event) => {
  console.log('Collected: %s', event.detail)
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
    depth: Number.MAX_SAFE_INTEGER
  })
}, 2000)
