import { isNil } from '@zhengxs/shared';

import { createContextProxy, type Context } from './context.js';
import { Script, type ScriptOptions } from './script.js';

const SCOPED_PROPERTIES = ['module', 'exports', 'require', 'process'];

const READONLY_PROPERTIES = ['module', 'require', 'process'];

export class ModuleScript<T extends Record<PropertyKey, unknown>> {
  private readonly env: Record<string, string> | undefined;
  private readonly script: Script;

  private readonly require: (path: string) => any;

  constructor(code: string, options?: ModuleScriptOptions) {
    const { env, scopes = [], module, ...rest } = options || {};

    this.env = env || {};

    this.script = new Script(code, {
      ...rest,
      scopes: [...scopes, ...SCOPED_PROPERTIES],
    });

    this.require = createRequire(module || {});
  }

  getExports(contextifiedObject: Context) {
    const { proxy } = this.runInNewContext(contextifiedObject);
    return (proxy as ModuleProxy<T>).exports;
  }

  runInNewContext(contextifiedObject: Context) {
    const context = this.createContext(contextifiedObject);
    this.script.runInContext(context);
    return context;
  }

  createContext(contextifiedObject: Context) {
    const { env, require } = this;

    const target = { exports: {} };
    const process = { env };

    return createContextProxy(contextifiedObject, {
      has(_, prop: string) {
        return SCOPED_PROPERTIES.includes(prop);
      },
      get(_, prop: string) {
        switch (prop) {
          case 'module':
            return target;

          case 'exports':
            return target.exports;

          case 'require':
            return require;

          case 'process':
            return process;

          default:
            return undefined;
        }
      },
      set(_, prop: string, value: T) {
        if (READONLY_PROPERTIES.includes(prop)) {
          return true;
        }

        if (prop === 'exports') {
          target.exports = value;
          return true;
        }

        return false;
      },
    });
  }
}

export interface ModuleScriptOptions extends ScriptOptions {
  /**
   * 环境变量
   */
  env?: Record<string, string>;

  /**
   * 模块解析配置
   */
  module?: ModuleRequire.ResolveOptions;
}

interface ModuleProxy<T> {
  exports: T;
}

namespace ModuleRequire {
  export interface ResolveOptions {
    /**
     * 模块缓存
     */
    alias?: Record<string, any>;

    /**
     * 模块解析函数
     *
     * @param path 模块路径
     * @returns 模块
     */
    resolve?: (path: string) => any;
  }
}

function createRequire({ resolve, alias }: ModuleRequire.ResolveOptions) {
  const cache = new Map(Object.entries(alias || {}));

  return (path: string) => {
    if (cache.has(path)) {
      return cache.get(path);
    }

    const mod = resolve ? resolve(path) : null;

    if (isNil(mod)) {
      throw new Error(`Cannot find module '${path}'`);
    }

    cache.set(path, mod);

    return mod;
  };
}
