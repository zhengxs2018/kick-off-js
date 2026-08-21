import { createFetch } from '../src/index.js';

const { setBaseURL, request } = createFetch();

setBaseURL('https://www.baidu.com');

const { data } = await request({
  url: '/su',
  params: {
    wd: 'wq',
    action: 'opensearch',
  },
});

console.log('data', typeof data, data);
