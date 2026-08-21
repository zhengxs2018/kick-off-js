/**
 * 自动补全开始斜线
 *
 * @param path - 路径
 *
 * @example
 *
 * ```js
 * addLeadingSlash('')
 * //=> /
 *
 * addLeadingSlash('/')
 * //=> /
 *
 * addLeadingSlash('foo')
 * //=> /foo
 *
 * addLeadingSlash('/foo')
 * //=> /foo
 *
 * addLeadingSlash('/foo/')
 * //=> /foo/
 * ```
 */
export function addLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * 自动补全末尾斜线
 *
 * @param path - 路径
 * @example
 *
 * ```js
 * addEndingSlash('')
 * //=> /
 *
 * addEndingSlash('/')
 * //=> /
 *
 * addEndingSlash('foo')
 * //=> foo/
 *
 * addEndingSlash('/foo')
 * //=> /foo/
 *
 * addEndingSlash('/foo/')
 * //=> /foo/
 * ```
 */
export function addEndingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/**
 * 移除末尾斜线
 *
 * @param str - URL 字符串
 *
 * @example
 *
 * ```js
 * removeEndingSlash('/')
 * // => ""
 *
 * removeEndingSlash('/base/')
 * // => "/base"
 * ```
 */
export const removeEndingSlash = (str: string): string => str.replace(/\/$/, '');

/**
 * 移除开头斜线
 *
 * @param str - URL 字符串
 *
 * @example
 *
 * ```js
 * removeLeadingSlash('/')
 * // => ""
 *
 * removeLeadingSlash('/base/')
 * // => "base/"
 * ```
 */
export const removeLeadingSlash = (str: string): string => str.replace(/^\//, '');

/**
 * 判断是否为 http 链接
 *
 * @param link - http 链接
 *
 * @example
 *
 * ```js
 * isHttpLink('http://github.com') // => true
 * isHttpLink('https://github.com') // => true
 * isHttpLink('//github.com') // => true
 * ```
 */
export const isHttpLink = (link: string): boolean => /^(https?:)?\/\//.test(link);

export function buildURL(base: string, path: string) {
  return isHttpLink(path) || !base
    ? path
    : `${removeEndingSlash(base)}/${removeLeadingSlash(path)}`;
}

export function combinedURL(
  base: string,
  path: string,
  params?: string[][] | Record<string, string> | string | URLSearchParams,
) {
  let url = buildURL(base, path);

  if (!params) return url;

  const target = new URL(url);

  const { searchParams } = target;

  new URLSearchParams(params).forEach((value, key) => {
    if (searchParams.has(key)) {
      searchParams.append(key, value);
    } else {
      searchParams.set(key, value);
    }
  });

  return target.toString();
}
