import { inBrowser, inNodeJS } from './detection.js'

let fallbackGlobalObject: object

function resolveGlobalObject(): object {
  return typeof globalThis !== 'undefined'
    ? globalThis
    : inNodeJS
    ? global
    : inBrowser
    ? window
    : typeof self !== 'undefined'
    ? self
    : {}
}

export function setGlobalObject<T extends object>(o: object) {
  fallbackGlobalObject = o
  return o as T & typeof globalThis
}

export function getGlobalObject<T extends object>() {
  return (
    (fallbackGlobalObject as T & typeof globalThis) ||
    setGlobalObject<T>(resolveGlobalObject())
  )
}
