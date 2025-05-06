import { arrayify } from '@zhengxs/shared'

export interface CompilerOptions {
  filename?: string
  alias?: string | string[]
  inject?: string | string[]
}

export class Compiler {
  readonly filename: string | undefined
  private __call__: Function

  constructor(code: string, opts: CompilerOptions = {}) {
    this.filename = opts.filename
    this.__call__ = compile(code, opts)
  }

  protected execute(context: CompilerOptions) {
    Reflect.apply(this.__call__, context, [context, context, context, context])
  }
}

function compile(code: string, opts: CompilerOptions) {
  const { filename, alias, inject } = opts
  const sourceUrl = filename ? `//# sourceURL=${filename}\n` : ''

  const scopedGlobalVariables = arrayify(alias)
  const scopedContextVariables = arrayify(inject)

  const body: string[] = [
    '"use strict";',
    scopedGlobalVariables.length
      ? `const ${scopedGlobalVariables.join('=')} = this`
      : '',
    scopedContextVariables.length
      ? `const {${scopedContextVariables.join(',')}}=this;`
      : '',
    code,
    sourceUrl,
  ]

  return new Function(
    'window',
    'globalThis',
    'self',
    'global',
    `${body.join('')}\n${sourceUrl}`
  )
}
