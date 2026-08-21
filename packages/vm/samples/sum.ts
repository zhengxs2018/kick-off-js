import './polyfill.js';
import { runInNewContext } from '../src/index.js';

const result = runInNewContext(
  'a + 5',
  { a: 100 },
  {
    returnValue: true,
  },
);

console.log(result);
