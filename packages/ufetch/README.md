# @zhengxs/ufetch

> 仅支持 uni-app.

让微信小程序的也支持流式传输。

## 安装

```sh
$ pnpm add @zhengxs/ufetch
```

### 使用

```ts
import { request } from '@zhengxs/ufetch';
import { EventSourceParserStream } from 'eventsource-parser/stream';

const { data } = await request({
  url: 'https://<your base url>/chat/completions',
  method: 'POST',
  headers: {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    Authorization: 'Bearer <your apikey>',
  },
  responseType: 'stream',
  data: {
    model: 'glm-4',
    stream: true,
    messages: [{ role: 'user', content: 'hi' }],
  },
});

const stream = data.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());

for await (const event of stream) {
  console.log('event', event);
}
```

## 如何在微信小程序中使用

添加 polyfill 和 sse 解析模块

```sh
pnpm add web-streams-polyfill text-decoding eventsource-parser
```

解决微信小程序中不存在 `TransformStream` 的问题。

```js
import { TransformStream } from '@zhengxs/ufetch/shims';
import { createParser } from 'eventsource-parser';

export function EventSourceParserStream({ onError, onRetry, onComment } = {}) {
  let parser;

  return new TransformStream({
    start(controller) {
      parser = createParser({
        onEvent: event => {
          controller.enqueue(event);
        },
        onError(error) {
          if (onError === 'terminate') {
            controller.error(error);
          } else if (typeof onError === 'function') {
            onError(error);
          }
        },
        onRetry,
        onComment,
      });
    },
    transform(chunk) {
      parser.feed(chunk);
    },
  });
}
```

从 `@zhengxs/ufetch/uni` 中导出请求方法和 `TextDecoderStream` 对象。

```ts
import '@zhengxs/ufetch/shims/uni'; // 必须在最顶部
import { TextDecoderStream } from '@zhengxs/ufetch/shims';
import { request } from '@zhengxs/ufetch/uni';

const { data } = await request({
  url: 'https://<your base url>/chat/completions',
  method: 'POST',
  headers: {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    Authorization: 'Bearer <your apikey>',
  },
  responseType: 'stream',
  data: {
    model: 'gpt-4',
    stream: true,
    messages: [{ role: 'user', content: 'hi' }],
  },
});

const stream = data.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());

for await (const event of stream) {
  console.log('event', event);
}
```

## License

MIT
