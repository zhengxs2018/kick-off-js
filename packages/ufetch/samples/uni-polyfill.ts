global.uni = {
  request(config: any) {
    const { success, fail, signal } = config;

    const ac = new AbortController();

    signal?.signal.addEventListener('abort', () => {
      ac.abort();
    });

    const promise = sendRequest({ ...config, signal: ac.signal });

    if (success) {
      promise.then(success, fail);
      return ac;
    }

    return promise;
  },
};

async function sendRequest(config) {
  const { url, method, header, data, dataType, responseType } = config;

  const options: RequestInit = {
    method,
    headers: header,
  };

  if (data) {
    if (typeof data === 'string') {
      options.body = data;
    } else if (data instanceof ArrayBuffer) {
      options.body = data;
    } else {
      options.body = JSON.stringify(data);
    }
  }

  const response = await fetch(url, options);

  if (dataType === 'json') {
    return {
      statusCode: response.status,
      data: await response.json(),
    };
  }

  if (responseType === 'arraybuffer') {
    return {
      statusCode: response.status,
      data: await response.arrayBuffer(),
    };
  }

  return {
    statusCode: response.status,
    data: await response.text(),
  };
}
