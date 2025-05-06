import { compose } from './compose.js'

export interface AppOptions {
  notfound: (request: Request) => Response
  onerror: (error: unknown) => void
}

export type AppConfig = Partial<AppOptions>

export interface AppContext {
  [name: string]: unknown
}

export interface MiddlewareContext {
  url: URL
  request: Request
  state: Record<string, any>
  respondWith: (response: Response) => void
}

export type Middleware = compose.Middleware<MiddlewareContext>

export type MaybePromise<T> = T | Promise<T>

export type DisposableLike = {
  dispose(): void
}
