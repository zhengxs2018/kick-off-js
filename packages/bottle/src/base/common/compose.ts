// copyright (c) 2023, the Koa authors (https://koajs.com)

export function compose<Context>(
  funcs: compose.Middleware<Context>[],
  done?: compose.Done<Context>
) {
  if (process.env.NODE_ENV === 'production') {
    return compose.define(funcs, done)
  }

  return compose.debug(funcs, done)
}

export namespace compose {
  export type Next = () => Promise<any>

  export type Done<T> = (context: T) => any

  export type Middleware<T> = (context: T, next: Next) => any

  export function define<Context>(
    funcs: Middleware<Context>[],
    done?: Done<Context>
  ) {
    function dispatch(ctx: Context, i: number = 0) {
      return async () => {
        const fn = funcs[i] || done
        if (!fn) return

        return await fn(ctx, dispatch(ctx, i + 1))
      }
    }

    return (ctx: Context) => dispatch(ctx)()
  }

  export function debug<Context>(
    funcs: Middleware<Context>[],
    done?: Done<Context>
  ) {
    return async (ctx: Context) => {
      const dispatch = async (i: number) => {
        const fn = i === funcs.length ? done : funcs[i]
        if (!fn) return

        let nextCalled = false
        let nextResolved = false

        const nextProxy = async () => {
          if (nextCalled) throw Error('next() called multiple times')
          nextCalled = true

          try {
            return await dispatch(i + 1)
          } finally {
            nextResolved = true
          }
        }

        const result = await fn(ctx, nextProxy)

        if (nextCalled && !nextResolved) {
          throw Error(
            'Middleware resolved before downstream.\n\tYou are probably missing an await or return'
          )
        }

        return result
      }

      return dispatch(0)
    }
  }
}
