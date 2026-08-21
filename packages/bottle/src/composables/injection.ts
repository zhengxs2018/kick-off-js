import { useContext } from '../app/context.js';

interface InjectionConstraint<T> {}

export type InjectionKey<T> = symbol & InjectionConstraint<T>;

export interface InjectionFunction<T> {
  (key: InjectionKey<T> | string): T | undefined;
  (key: InjectionKey<T> | string, defaultValue: T): T;
  (key: InjectionKey<T> | string, defaultValue: T | (() => T)): T;
  (key: InjectionKey<T> | string, defaultValue: T | (() => T), treatDefaultAsFactory: true): T;
  (key: InjectionKey<T> | string, defaultValue?: unknown, treatDefaultAsFactory?: boolean): T;
}

export function provide<T, K = InjectionKey<T> | PropertyKey>(
  key: K,
  value: K extends InjectionKey<infer V> ? V : T,
): void {
  const { provides } = useContext();

  // @ts-expect-error ignore type error
  provides[key] = value;
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined;
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false,
): T;
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true,
): T;
export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false,
) {
  const { provides } = useContext();

  if (key in provides) {
    return provides[key] as unknown;
  }

  if (arguments.length === 0) {
    console.warn(`injection "${String(key)}" not found.`);
  }

  if (treatDefaultAsFactory && typeof defaultValue === 'function') {
    return defaultValue();
  }

  return defaultValue;
}
