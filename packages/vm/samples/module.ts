import { isNil } from '@zhengxs/shared';

import './polyfill.js';
import { ModuleScript } from '../src/index.js';

type Extension = {
  activate: () => void;
};

const code = `
const { isNil } = require('@zhengxs/shared')

const msg = 'hello,module'


exports.activate = function () {
  console.log('环境变量', process.env.NODE_ENV)
  console.log('全局变量', abc)
  console.log('函数调用', isNil(null), isNil(1))
  console.log('当前上下文变量', msg)
}`;

const vm = new ModuleScript<Extension>(code, {
  env: {
    NODE_ENV: 'development',
  },
  module: {
    alias: {
      '@zhengxs/shared': { isNil },
    },
  },
  scopes: ['abc'],
});

const exports = vm.getExports({
  abc: '123',
});

exports.activate();
//=> Prints:
//=> 环境变量 development
//=> 全局变量 123
//=> 函数调用 false false
//=> 当前上下文变量 hello,module
