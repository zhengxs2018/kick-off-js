import { ReadableStream } from '../_shims/registry.js';
import { AxiosError, createAxios, type Axios } from '../core.js';

export type UniRequestConfig = Omit<
  UniNamespace.RequestOptions,
  'responseType' | 'enableChunked' | 'header' | 'success' | 'fail'
> &
  Axios.RequestConfig;

export type UniRequestOptions = Omit<
  UniNamespace.RequestOptions,
  'responseType' | 'enableChunked' | 'header' | 'success' | 'fail'
> &
  Axios.RequestOptions;

export function createUniFetch(options?: Partial<Axios.RequestDefaults>) {
  return createAxios<
    Axios.RequestDefaults,
    UniRequestConfig,
    UniRequestOptions,
    UniApp.RequestSuccessCallbackResult
  >((config: UniRequestOptions) => {
    if (config.responseType === 'stream') {
      return sendRequestWithStream(config);
    }

    return sendRequest(config);
  }, options);
}

export const { setToken, setAuthorization, setBaseURL, setHeader, setHeaders, request } =
  createUniFetch();

function sendRequest(config: UniRequestOptions) {
  return new Promise<
    Axios.Response<UniRequestOptions, unknown, UniApp.RequestSuccessCallbackResult>
  >((resolve, reject) => {
    const { headers, responseType, signal, ...rest } = config;

    const options: UniNamespace.RequestOptions = {
      ...rest,
      header: headers,
    };

    if (responseType === 'json') {
      options.dataType = 'json';
      options.responseType = 'text';
    } else if (responseType === 'arraybuffer' || responseType === 'text') {
      options.responseType = responseType;
    }

    const requestTask = uni.request({
      ...options,
      success(response) {
        resolve({
          config,
          response,
          status: response.statusCode,
          statusText: 'ok',
          data: response.data,
        });
      },
      fail(ex) {
        reject(new AxiosError(ex.errMsg, config));
      },
    });

    signal?.addEventListener('abort', () => {
      requestTask.abort();
      reject(new AxiosError('Request aborted', config));
    });
  });
}

function sendRequestWithStream(config: UniRequestOptions) {
  return new Promise<
    Axios.Response<UniRequestOptions, unknown, UniApp.RequestSuccessCallbackResult>
  >((resolve, reject) => {
    const stream = new ReadableStream({
      start(controller) {
        const { headers, responseType, signal, ...rest } = config;

        const options: UniNamespace.RequestOptions = {
          ...rest,
          header: headers,
          responseType: 'arraybuffer',
          enableChunked: true,
        };

        const onStart = (response: any) => {
          resolve({
            config,
            response,
            status: response.statusCode,
            statusText: 'ok',
            data: stream,
          });
        };

        const onChunk = ({ data }: { data: unknown }) => {
          controller.enqueue(data);
        };

        const requestTask = uni.request({
          ...options,
          complete() {
            requestTask.offHeadersReceived(onStart);
            // @ts-expect-error ignore type error
            requestTask.offChunkReceived(onChunk);
          },
          fail(ex) {
            reject(new AxiosError(ex.errMsg, config));
          },
        });

        requestTask.onHeadersReceived(onStart);

        // @ts-expect-error ignore type error
        requestTask.onChunkReceived(onChunk);

        signal?.addEventListener('abort', () => {
          requestTask.abort();
          reject(new AxiosError('Request aborted', config));
        });
      },
    });
  });
}
