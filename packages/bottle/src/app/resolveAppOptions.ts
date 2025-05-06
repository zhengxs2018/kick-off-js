import type { AppConfig, AppOptions } from '../base/common/types.js'

export function resolveAppOptions(config?: AppConfig): AppOptions {
  const { notfound = onPageNotFound, onerror = onServerError } = config || {}

  return {
    notfound,
    onerror,
  }
}

function onServerError(error: unknown) {
  console.error('Server error:', error)
}

function onPageNotFound() {
  return new Response('Not Found', { status: 404, statusText: 'Not Found' })
}
