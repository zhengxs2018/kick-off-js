import { mlo, eventTarget, domTree, promises } from '@zhengxs/mlo';

import React from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './App.js';
import { createMemoryLeak } from './leak.js';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 避免把 react 框架监听到
setTimeout(() => {
  mlo.use(promises);
  mlo.use(eventTarget);
  mlo.use(domTree, {
    root: '#root',
    monitor: true,
    scan: true,
    rules: [
      { type: 'exact', test: 'style', reason: '' },
      { type: 'exact', test: 'script', reason: '' },
      { type: 'exact', test: 'noscript', reason: '' },
    ],
  });

  createMemoryLeak();
}, 0);
