import './polyfill.js';
import { runInNewContext } from '../src/index.js';

(window as any).globalVar = 3;

const context = {
  globalVar: 1,
};

runInNewContext(`globalVar *= 2`, context);

console.log(context);
// Prints: { globalVar: 2 }

console.log((window as any).globalVar);
// Prints: 3
