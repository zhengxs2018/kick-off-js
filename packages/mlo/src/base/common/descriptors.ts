/**
 * 创建只读的属性描述符
 *
 * @param value - 属性值
 * @returns 属性描述符
 */
export function readonly<T>(value: T): PropertyDescriptor {
  return {
    value: value,
    writable: false,
    enumerable: true,
    configurable: false,
  };
}

/**
 * 创建可写的属性描述符
 *
 * @param value - 属性值
 * @returns 属性描述符
 */
export function writable<T>(value: T): PropertyDescriptor {
  return {
    value: value,
    writable: true,
    enumerable: true,
    configurable: false,
  };
}

/**
 * 创建常量属性描述符
 *
 * @param value - 属性值
 * @returns 属性描述符
 */
export function constant<T>(value: T): PropertyDescriptor {
  return {
    value: value,
    writable: false,
    enumerable: false,
    configurable: false,
  };
}

/**
 * 创建 getter 属性描述符
 *
 * @param getter - getter 函数
 * @returns 属性描述符
 */
export function getter<T>(getter: () => T): PropertyDescriptor {
  return {
    get: getter,
    enumerable: true,
    configurable: false,
  };
}
