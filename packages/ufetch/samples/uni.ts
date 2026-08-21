import './uni-polyfill.js';
import { createUniFetch } from '../src/main/main.uni.js';

const { setBaseURL, request } = createUniFetch();

setBaseURL('https://www.baidu.com');

const { data } = await request({
  url: '/su',
  params: {
    wd: 'wq',
    action: 'opensearch',
  },
});

console.log('data', typeof data, data);
