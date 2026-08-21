import {
  mlo,
  promises,
  eventTarget,
  domTree,
  snapshot,
  createMloMessage,
  NativeSetInterval,
} from '@zhengxs/mlo';

mlo.use(promises);
mlo.use(eventTarget);
mlo.use(domTree, {
  scan: true,
  monitor: true,
});

let target: Window | null = null;

sendMessage();
NativeSetInterval(sendMessage, 2000);

function sendMessage() {
  GetOrCreateTarget().postMessage(createMloMessage('snapshot', snapshot()), location.origin);
}

function GetOrCreateTarget(): Window {
  if (target && !target.closed) {
    return target;
  }

  target = window.open('./ui/index.html', 'ui', 'width=960,height=680');

  return target!;
}
