import { Compiler, type CompilerOptions } from './compiler.js'
import { type Context, isContext } from './context.js'

export interface ScriptOptions extends CompilerOptions {
  // pass
}

export class Script extends Compiler {
  runInContext(context: Context) {
    if (!isContext(context)) {
      throw new Error(
        '[Sandbox] The "context" argument must be an Context. Received an instance of Object'
      )
    }

    this.execute(context.proxy)
  }
}
