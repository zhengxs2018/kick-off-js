import { Readable } from 'node:stream'
import type { TLSSocket } from 'node:tls'
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'

export function toWebRequest(req: IncomingMessage): readonly [URL, Request] {
  const { method, headers } = req

  const init: RequestInit = {
    method: method,
    headers: toWebHeaders(headers),
  }

  if (hasBody(method)) {
    init.duplex = 'half'
    init.body = Readable.toWeb(req) as globalThis.ReadableStream<Uint8Array>
  }

  const url = toWebURL(req)

  return [url, new Request(url, init)] as const
}

export function hasBody(method: string | undefined) {
  return method && (method === 'POST' || method === 'PUT' || method === 'PATCH')
}

export function toWebURL(req: IncomingMessage): URL {
  const protocol = (req.socket as TLSSocket).encrypted ? 'https' : 'http'
  const host = req.headers.host || req.socket.localAddress
  const path = req.url || '/'

  return new URL(`${protocol}://${host}${path}`)
}

export function toWebHeaders(headers: IncomingHttpHeaders): Headers {
  const webHeaders = new Headers()

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        webHeaders.append(key, v)
      }
    } else {
      webHeaders.append(key, value!)
    }
  }

  return webHeaders
}
