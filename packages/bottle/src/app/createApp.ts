import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'

import type { ListenOptions } from 'node:net'

import type { AppConfig, Middleware } from '../base/common/types.js'
import { compose } from '../base/common/compose.js'
import { fromServerError, fromWebResponse } from '../base/node/response.js'
import { runInContext } from './context.js'
import { resolveAppOptions } from './resolveAppOptions.js'

export function createApp(config?: AppConfig) {
  const options = resolveAppOptions(config)

  const context = Object.create(null)
  const provides = Object.create(null)
  const middleares: Middleware[] = []

  function provide(key: PropertyKey, value: unknown) {
    if (key in provides) {
      throw new Error(`Injection key "${String(key)}" already exists.`)
    }

    provides[key] = value
  }

  function use(middleware: Middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Middleware must be a function')
    }

    middleares.push(middleware)
  }

  function createContext(
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>
  ) {
    const ctx = Object.create(context)

    ctx.req = req
    ctx.res = res
    ctx.provides = Object.create(provides)

    return ctx
  }

  function callback() {
    const { notfound, onerror } = options
    const funcs = compose(middleares)

    return (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
      return runInContext(createContext(req, res), async (ctx) => {
        try {
          const respondWith = (response: Response) => {
            if (ctx.writable) {
              ctx.respond = true
              fromWebResponse(res, response)
            } else {
              onerror(new Error('Response is not writable'))
            }
          }

          const response = await funcs({
            url: ctx.url,
            request: ctx.request,
            state: {},
            respondWith,
          })

          if (response instanceof Response) {
            respondWith(response)
          } else if (ctx.writable) {
            ctx.respond = true
            fromWebResponse(res, notfound(ctx.request))
          }
        } catch (error) {
          if (ctx.writable) {
            ctx.respond = true
            fromServerError(res, error)
          }

          onerror(error)
        } finally {
          ctx.subscriptions.forEach((sub) => sub.dispose())
          ctx.subscriptions.length = 0
        }
      })
    }
  }

  function listen(
    port?: number,
    hostname?: string,
    backlog?: number,
    listeningListener?: () => void
  ): Server
  function listen(
    port?: number,
    hostname?: string,
    listeningListener?: () => void
  ): Server
  function listen(
    port?: number,
    backlog?: number,
    listeningListener?: () => void
  ): Server
  function listen(port?: number, listeningListener?: () => void): Server
  function listen(
    path: string,
    backlog?: number,
    listeningListener?: () => void
  ): Server
  function listen(path: string, listeningListener?: () => void): Server
  function listen(
    options: ListenOptions,
    listeningListener?: () => void
  ): Server
  function listen(
    handle: any,
    backlog?: number,
    listeningListener?: () => void
  ): Server
  function listen(handle: any, listeningListener?: () => void): Server
  function listen(...args: any[]) {
    return createServer(callback()).listen(...args)
  }

  return {
    options,
    context,
    provide,
    use,
    callback,
    listen,
  }
}
