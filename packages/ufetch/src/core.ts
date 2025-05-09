import { combinedURL, hasOwn, isNil } from '@zhengxs/shared'

export type Method =
  | 'get'
  | 'head'
  | 'post'
  | 'put'
  | 'delete'
  | 'connect'
  | 'options'
  | 'trace'

export type AuthorizationType =
  | 'Basic'
  | 'Bearer'
  | 'Digest'
  | 'HOBA'
  | 'Mutual'
  | 'Negotiate / NTLM'
  | 'VAPID'
  | 'SCRAM'
  | 'AWS4-HMAC-SHA256'

type MaybePromise<T> = T | Promise<T>

export namespace Axios {
  export type RequestMethod = (string & {}) | Method | Uppercase<Method>

  export type RawRequestHeaderValue =
    | string[]
    | string
    | number
    | null
    | undefined
  type RawRequestHeaderValueFactory = () => MaybePromise<RawRequestHeaderValue>

  export type RequestHeaderValue =
    | RawRequestHeaderValue
    | RawRequestHeaderValueFactory
  export type RequestHeaders = Record<string, RequestHeaderValue>

  export type RequestDefaults = {
    baseURL: string
    method: RequestMethod
    headers: RequestHeaders
    [name: string]: unknown
  }

  export interface RequestConfig {
    baseURL?: string
    url: string
    method?: RequestMethod
    params?: string[][] | Record<string, string> | string | URLSearchParams
    headers?: RequestHeaders
    data?: unknown
    signal?: AbortSignal
    responseType?: ResponseType
  }

  export interface RequestOptions
    extends Omit<RequestConfig, 'params' | 'headers'> {
    method: RequestMethod
    headers: Record<string, string>
  }

  export type ResponseType =
    | 'arraybuffer'
    | 'blob'
    | 'json'
    | 'text'
    | 'stream'
    | 'formdata'

  export interface Response<
    Config extends RequestConfig,
    Data = unknown,
    RawResponse = globalThis.Response
  > {
    status: number
    statusText: string
    response: RawResponse
    config: Config
    data: Data
  }
}

export interface Axios<
  Defaults extends Axios.RequestDefaults,
  Config extends Axios.RequestConfig,
  Options extends Axios.RequestOptions,
  Response = globalThis.Response
> {
  defaults: Defaults
  setToken: (credentials: string, type?: AuthorizationType) => void
  setBaseURL: (baseURL: string) => void
  setHeader: (name: string, value: Axios.RequestHeaderValue) => void
  setHeaders: (headers: Record<string, Axios.RequestHeaderValue>) => void
  setAuthorization: (value: Axios.RequestHeaderValue) => void

  request(
    config: Config & { responseType: 'text' }
  ): Promise<Axios.Response<Options, string, Response>>

  request(
    config: Config & { responseType: 'blob' }
  ): Promise<Axios.Response<Options, Blob, Response>>

  request(
    config: Config & { responseType: 'formdata' }
  ): Promise<Axios.Response<Options, FormData, Response>>

  request(
    config: Config & { responseType: 'arraybuffer' }
  ): Promise<Axios.Response<Options, ArrayBuffer, Response>>

  request(
    config: Config & { responseType: 'stream' }
  ): Promise<Axios.Response<Options, ReadableStream, Response>>

  request<T = unknown>(
    config: Config
  ): Promise<Axios.Response<Options, T, Response>>
}

export function createAxios<
  Defaults extends Axios.RequestDefaults,
  Config extends Axios.RequestConfig,
  Options extends Axios.RequestOptions,
  Response = globalThis.Response
>(
  fetch: (options: Options) => Promise<Axios.Response<Options, any, Response>>,
  options?: Partial<Defaults>
): Axios<Defaults, Config, Options, Response> {
  const defaults: Defaults = Object.assign(
    {
      baseURL: '/',
      method: 'GET',
      headers: {},
    } as Defaults,
    options
  )

  function setBaseURL(baseURL: string) {
    defaults.baseURL = baseURL
  }

  function setHeader(name: string, value: Axios.RequestHeaderValue) {
    if (value == null) return

    if (!defaults.headers) {
      defaults.headers = {}
    }

    if (typeof value === 'string') {
      defaults.headers[name] = value
    } else {
      defaults.headers[name] = String(value)
    }
  }

  function setHeaders(headers: Record<string, Axios.RequestHeaderValue>) {
    Object.keys(headers).forEach((key) => {
      setHeader(key, headers[key])
    })
  }

  function setAuthorization(value: Axios.RequestHeaderValue) {
    return setHeader('Authorization', value)
  }

  function setToken(credentials: string, type?: AuthorizationType) {
    setAuthorization((type || 'Bearer') + ' ' + credentials)
  }

  async function request(config: Config) {
    const options = await mergeRequestOptions<Defaults, Config, Options>(
      defaults,
      config
    )

    return fetch(options)
  }

  return {
    defaults,
    setToken,
    setAuthorization,
    setBaseURL,
    setHeader,
    setHeaders,
    request,
  }
}

export class AxiosError<Response = unknown> extends Error {
  constructor(
    public message: string,
    public config: Axios.RequestOptions,
    public response?: Response,
    public status?: number,
    public statusText?: string
  ) {
    super(message)
  }
}

export function isAxiosError(o: unknown): o is AxiosError {
  return o instanceof AxiosError
}

async function mergeRequestOptions<
  Defaults extends Axios.RequestDefaults,
  Config extends Axios.RequestConfig,
  Options extends Axios.RequestOptions
>(target: Defaults, source: Config): Promise<Options> {
  const { baseURL, method, url, params, headers = {}, ...rest } = source

  const options = {
    ...rest,
    url: combinedURL(baseURL || target.baseURL, url, params),
    method: method || target.method,
    headers: await mergeHeaders(target.headers || {}, headers),
  } as unknown as Options

  return options
}

async function mergeHeaders(
  defaultHeaders: Axios.RequestHeaders,
  userHeaders: Axios.RequestHeaders
) {
  const promises: Promise<unknown>[] = []
  const headers: Record<string, string | string[]> = {}

  function setHeader(name: string, value: Axios.RawRequestHeaderValue) {
    if (isNil(value)) return

    if (typeof value === 'number') {
      headers[name] = value.toString()
    } else {
      headers[name] = value
    }
  }

  async function resolveHeader(name: string, value: Axios.RequestHeaderValue) {
    if (typeof value === 'function') {
      setHeader(name, await value())
    } else {
      setHeader(name, value)
    }
  }

  Object.keys(defaultHeaders).forEach((name) => {
    if (hasOwn(userHeaders, name)) return
    promises.push(resolveHeader(name, defaultHeaders[name]))
  })

  Object.keys(userHeaders).forEach((name) => {
    promises.push(resolveHeader(name, userHeaders[name]))
  })

  if (promises.length) {
    await Promise.all(promises)
  }

  return headers
}
