const hasOwnProperty = Object.prototype.hasOwnProperty;

export function isNil(value: unknown): value is null | undefined {
  return value === undefined || value === null;
}

export function hasOwn<T, K extends PropertyKey = PropertyKey>(
  o: unknown,
  prop: K,
): o is T & Record<K, unknown> {
  return isNil(o) == false && hasOwnProperty.call(o, prop);
}

export function prop<T>(o: Record<PropertyKey, T>, prop: PropertyKey): T | undefined;

export function prop<T>(
  o: Record<PropertyKey, T>,
  prop: PropertyKey,
  defaultValue: T,
  treatDefaultAsFactory?: false,
): T;
export function prop<T>(
  o: Record<PropertyKey, T>,
  prop: PropertyKey,
  defaultValue: PropertyGetterFactory<T>,
  treatDefaultAsFactory: true,
): T;

export function prop<T>(
  o: Record<PropertyKey, T>,
  prop: PropertyKey,
  defaultValue?: T | PropertyGetterFactory<T>,
  treatDefaultAsFactory?: boolean,
) {
  const value = hasOwn(o, prop) ? o[prop] : void 0;

  return isNil(value) && !isNil(defaultValue)
    ? defaultToValue(o, prop, defaultValue, treatDefaultAsFactory)
    : value;
}

type PropertyGetterFactory<T> = (o: Record<PropertyKey, T>, prop: PropertyKey) => T;

function defaultToValue<T>(
  o: Record<PropertyKey, T>,
  prop: PropertyKey,
  defaultValue: T | PropertyGetterFactory<T>,
  treatDefaultAsFactory?: boolean,
) {
  return treatDefaultAsFactory
    ? (defaultValue as PropertyGetterFactory<T>)(o, prop)
    : (defaultValue as T);
}
