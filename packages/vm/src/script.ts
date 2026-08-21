import { type Context, createContext, isContext } from './context.js';
import { compile, type CompileOptions } from './compile.js';

export interface ScriptOptions extends CompileOptions {
  filename?: string | undefined;
}

export class Script {
  readonly filename: string | undefined;
  private __exec__: Function;

  constructor(code: string, opts?: ScriptOptions) {
    const { filename = '', ...rest } = opts || {};

    this.filename = filename;
    this.__exec__ = compile(filename, code, rest);
  }

  runInContext(context: Context) {
    if (isContext(context)) {
      return this.__exec__(context);
    }

    throw new TypeError('context must be a Context');
  }
}

export function runInNewContext(code: string, contextifiedObject: Context, opts?: ScriptOptions) {
  const script = new Script(code, { mode: 'eval', ...opts });
  return script.runInContext(createContext(contextifiedObject));
}
