import { EventSourceParserStream } from 'eventsource-parser/stream';

import { createFetch } from '../src/index.js';

const { setBaseURL, setToken, request } = createFetch();

setBaseURL('	https://open.bigmodel.cn');
setToken('you apikey');

const { data } = await request({
  url: '/api/paas/v4/chat/completions',
  method: 'POST',
  responseType: 'stream',
  data: {
    model: 'glm-4-plus',
    stream: true,
    messages: [{ role: 'user', content: '你好' }],
  },
});

const stream = data.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());

for await (const { data } of stream) {
  console.log(data);
}
