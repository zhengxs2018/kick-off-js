/**
 * 是否处于浏览器环境
 *
 * Note: 不排除 jsdom 是为了支持单元测试
 */
export const inBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

/**
 * 是否处于 NodeJS 环境
 */
export const inNodeJS =
  typeof process !== 'undefined' &&
  // eslint-disable-next-line eqeqeq
  process.versions != null &&
  // eslint-disable-next-line eqeqeq
  process.versions.node != null;
