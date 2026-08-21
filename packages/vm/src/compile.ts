import { arrayify } from '@zhengxs/shared';

export type CompileOptions = {
  mode?: (string & {}) | 'eval';
  globals?: string | string[];
  scopes?: string | string[];
  returnValue?: boolean;
};

export function compile(filename: string, code: string, options?: CompileOptions) {
  const { mode, globals, scopes, returnValue } = options || {};

  const sourceURL = filename ? `\n//# sourceURL=${filename}\n` : '';

  const scopedGlobalVariables = arrayify(globals);
  const scopedContextVariables = arrayify(scopes);

  const body = returnValue ? `return ${code}` : code;

  const source: string[] = [
    scopedGlobalVariables.length ? `const ${scopedGlobalVariables.join('=')} = this;` : '',
    scopedContextVariables.length ? `const {${scopedContextVariables.join(',')}} = this;` : '',
    mode === 'eval' ? `with(__context__){${body}}` : body,
    sourceURL,
  ];

  if (mode === 'eval') {
    return withEval(source.join(''));
  }

  return withExec(source.join(''));
}

function withEval(code: string) {
  const evaluate = new Function('__context__', 'window', 'self', 'globalThis', code);

  return (context: Record<PropertyKey, unknown>) => {
    const self = context.proxy;
    return Reflect.apply(evaluate, self, [context, self, self, self]);
  };
}

function withExec(code: string) {
  const evaluate = new Function('window', 'self', 'globalThis', code);

  return (context: Record<PropertyKey, unknown>) => {
    const self = context.proxy;
    return Reflect.apply(evaluate, self, [self, self, self]);
  };
}
