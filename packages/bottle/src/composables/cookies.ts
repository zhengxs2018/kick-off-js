import Cookies from 'cookies'

import { useContext } from '../app/context.js'
import type { Middleware } from '../base/common/types.js'
import { provide, inject, type InjectionKey } from './injection.js'

const CookieKey: InjectionKey<Cookies> = Symbol('cookies')

export function cookies(options?: Cookies.Option): Middleware {
  return (_, next) => {
    const { req, res } = useContext()

    const cookies = new Cookies(req, res, options)

    provide(CookieKey, cookies)

    return next()
  }
}

export function useCookies() {
  const cookies = inject(CookieKey)

  if (!cookies) {
    throw new Error(
      'Cookies not found in context.\nMake sure to use the cookies middleware.'
    )
  }

  return cookies
}
