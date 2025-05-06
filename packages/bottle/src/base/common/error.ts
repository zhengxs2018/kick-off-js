export interface ServerErrorObject {
  exposed: boolean
  code: number
  message: string
  stack?: string
}

export function castToError(err: unknown): Error {
  if (err instanceof Error) {
    return err
  }

  if (typeof err === 'object' && err !== null) {
    try {
      return new Error(JSON.stringify(err))
    } catch {}
  }

  return new Error(String(err))
}
