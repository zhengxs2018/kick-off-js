import './polyfill.js';
import { Script, createContext } from '../src/index.js';

const code = `
const msg = 'hello,script'

window.print = function () {
  console.log('环境变量', process.env.NODE_ENV)
  console.log('全局变量', abc)
  console.log('当前上下文变量', msg)
}`;

const vm = new Script(code, {
  scopes: ['process', 'abc'],
});

const context = createContext<{
  print: () => void;
}>({
  process: {
    env: {
      NODE_ENV: 'development',
    },
  },
  abc: '123',
});

vm.runInContext(context);

context.print();
//=> Prints:
//=> 环境变量 development
//=> 全局变量 123
//=> 当前上下文变量 hello,script
