import { Readable } from 'node:stream'
import type { ServerResponse } from 'node:http'

import type { ServerErrorObject } from '../common/error.js'

export function isWritableResponse(res: ServerResponse) {
  // can't write any more after response finished
  // response.writableEnded is available since Node > 12.9
  // https://nodejs.org/api/http.html#http_response_writableended
  // response.finished is undocumented feature of previous Node versions
  // https://stackoverflow.com/questions/16254385/undocumented-response-finished-in-node-js
  if (res.writableEnded || res.finished) return false

  const socket = res.socket

  // There are already pending outgoing res, but still writable
  // https://github.com/nodejs/node/blob/v4.4.7/lib/_http_server.js#L486
  if (!socket) return true

  return socket.writable
}

export function fromWebResponse(res: ServerResponse, response: Response) {
  const { headers, body, status, statusText } = response

  res.statusCode = status
  res.statusMessage = statusText

  for (const [key, value] of headers) {
    res.setHeader(key, value)
  }

  if (body) {
    Readable.fromWeb(body).pipe(res, {
      end: true,
    })
  } else {
    res.end()
  }
}

export function fromServerError(res: ServerResponse, error: unknown) {
  res.statusCode = 500
  res.statusMessage = 'Internal Server Error'

  if (isServerError(error)) {
    res.statusCode = error.code

    if (process.env.NODE_ENV === 'production') {
      res.end(error.message)
    } else {
      res.end(error.stack ?? error.message)
    }
  } else {
    res.end('Internal Server Error')
  }
}

export function isServerError(error: unknown): error is ServerErrorObject {
  return (
    error !== null &&
    typeof error === 'object' &&
    'exposed' in error &&
    'code' in error &&
    'message' in error
  )
}
