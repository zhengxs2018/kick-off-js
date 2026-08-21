/**
 * 是否在浏览器环境中
 */
export const inBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

export const inIframe =
  inBrowser && window.self !== window.top && typeof window.parent !== 'undefined';

/**
 * 是否在 Node.js 环境中
 */
export const inNode =
  typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

/**
 * 是否在 Web Worker 环境中
 */
export const inWebWorker =
  typeof self === 'object' &&
  self.constructor &&
  self.constructor.name === 'DedicatedWorkerGlobalScope';

/**
 * 是否在 Electron 环境中
 */
export const inElectron =
  typeof process !== 'undefined' && process.versions != null && process.versions.electron != null;

/**
 * 是否在 React Native 环境中
 */
export const inReactNative =
  typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
