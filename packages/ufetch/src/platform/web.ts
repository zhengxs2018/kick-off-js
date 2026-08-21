import { inBrowser, isNil } from '@zhengxs/shared';
import { createAxios, AxiosError, type Axios } from '../core.js';

export type FetchRequestConfig = Omit<globalThis.RequestInit, 'method' | 'headers'> &
  Axios.RequestConfig;

export type FetchRequestOptions = Omit<globalThis.RequestInit, 'method' | 'headers'> &
  Axios.RequestOptions;

export function createFetch(options?: Partial<Axios.RequestDefaults>) {
  return createAxios<Axios.RequestDefaults, FetchRequestConfig, FetchRequestOptions>(
    sendRequest,
    options,
  );
}

export const { setToken, setAuthorization, setBaseURL, setHeader, setHeaders, request } =
  createFetch();

async function sendRequest(config: FetchRequestOptions) {
  const { url, headers, data, responseType, ...init } = config;

  const reqHeaders = new Headers(headers);

  if (data) {
    init.body = transformRequest(data, reqHeaders);
  }

  if (responseType === 'json' && !reqHeaders.has('Accept')) {
    reqHeaders.set('Accept', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers: reqHeaders,
  });

  if (response.ok) {
    return afterResponse(config, response);
  }

  throw new AxiosError(
    `Request failed with status ${response.status}`,
    config,
    response,
    response.status,
    response.statusText,
  );
}

function transformRequest(data: unknown, headers: Headers): BodyInit {
  const contentType = headers.get('Content-Type');

  if (data instanceof FormData) {
    if (!contentType) {
      headers.set('Content-Type', 'multipart/form-data');
    }

    return data;
  }

  if (data instanceof URLSearchParams) {
    if (!contentType) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
    }
    return data;
  }

  if (data instanceof Blob || data instanceof ArrayBuffer) {
    if (!contentType) {
      headers.set('Content-Type', 'application/octet-stream');
    }

    return data;
  }

  const type = typeof data;

  if (type === 'string') {
    return data as string;
  }

  if (type !== 'object') {
    return String(data);
  }

  if (contentType) {
    if (contentType.startsWith('multipart/form-data')) {
      return transformFormData(data as Record<string, unknown>);
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      return new URLSearchParams(data as Record<string, string>);
    }

    return JSON.stringify(data);
  }

  headers.set('Content-Type', 'application/json');

  return JSON.stringify(data);
}

function transformFormData(data: Record<string, unknown>) {
  const formData = new FormData();

  function append(key: string, value: unknown) {
    if (isNil(value)) return;

    if (inBrowser && value instanceof File) {
      formData.append(key, value, value.name);
    } else {
      formData.append(key, value as string);
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        append(key, item);
      }
    } else {
      append(key, value);
    }
  }

  return formData;
}

async function afterResponse(config: FetchRequestOptions, response: Response) {
  const { status, statusText, headers } = response;

  const responseType = guessResponseType(config.responseType, headers.get('Content-Type'));

  const data = await transformResponseData(response, responseType);

  return { config, response, status, statusText, data };
}

function transformResponseData(
  response: globalThis.Response,
  responseType?: Axios.ResponseType | void,
) {
  switch (responseType) {
    case 'json':
      return response.json();
    case 'text':
      return response.text();
    case 'blob':
      return response.blob();
    case 'arraybuffer':
      return response.arrayBuffer();
    case 'formdata':
      return response.formData();
    case 'stream':
      return response.body;
    default:
      return response
        .json()
        .catch(() => response.text())
        .catch(() => response.body);
  }
}

const ContentTypeMapping: [string, Axios.ResponseType][] = [
  ['application/octet-stream', 'arraybuffer'],
  ['application/json', 'json'],
  ['multipart/form-data', 'formdata'],
  ['text/event-stream', 'stream'],
  ['image/', 'blob'],
  ['audio/', 'blob'],
  ['video/', 'blob'],
  ['font/', 'blob'],
  ['text/', 'text'],
];

function guessResponseType(
  responseType: Axios.ResponseType | undefined,
  contentType: string | null | undefined,
): Axios.ResponseType | void {
  if (responseType) {
    return responseType;
  }

  if (!contentType) {
    return;
  }

  for (const [type, responseType] of ContentTypeMapping) {
    if (contentType.startsWith(type)) {
      return responseType;
    }
  }
}
