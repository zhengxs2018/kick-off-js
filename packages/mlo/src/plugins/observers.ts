import type { MloRef, MloPluginObject, MloSetupContext, MloObjectStack } from '../types/index.js';
import {
  ref,
  inBrowser,
  NativeResizeObserver,
  NativeMutationObserver,
  writable,
  captureStack,
  constant,
} from '../base/index.js';

export type ObserversOptions = {
  /**
   * 是否启用大小观察者。
   *
   * 注意：启用此功能将导致CPU使用量显著增加。
   */
  resize?: boolean;

  /**
   * 是否启用DOM变动观察者。
   *
   * 注意：启用此功能将导致CPU使用量显著增加。
   */
  mutation?: boolean;
};

export function observers(options?: ObserversOptions): MloPluginObject {
  return {
    name: 'observers',
    setup({ subscriptions }: MloSetupContext) {
      if (!inBrowser) {
        console.debug(
          '[mlo] observers plugin is designed to work in browser environment, skipping setup.',
        );
        return;
      }

      if (options?.mutation) {
        subscriptions.push(MonitorMutationObserver());
      }

      if (options?.resize) {
        subscriptions.push(MonitorResizeObserver());
      }
    },
  };
}

function MonitorResizeObserver() {
  class MloResizeObserver extends NativeResizeObserver {
    private __mlo_refs__?: {
      cb: MloRef<object>;
      ob: MloRef<object>;
    };

    private __mlo_stack__!: MloObjectStack;

    constructor(callback: ResizeObserverCallback) {
      super(callback);

      const stack = {
        type: `ResizeObserver`,
        stack: captureStack(callback, 1)!,
        at: Date.now(),
      };

      const cbRef = ref(callback);

      cbRef.name = 'ResizeObserver.callback';
      cbRef.labels.add('observer-callback');
      cbRef.stacks.push(stack);

      const obRef = ref(this);

      obRef.name = 'ResizeObserver';
      cbRef.type = 'ResizeObserver';
      obRef.labels.add('observer');
      obRef.stacks.push(stack);

      cbRef.linkTo(obRef);

      Object.defineProperties(this, {
        __mlo_refs__: writable({ cb: cbRef, ob: obRef }),
        __mlo_stack__: constant(stack),
      });
    }

    observe(target: Element, options?: ResizeObserverOptions): void {
      const { __mlo_refs__, __mlo_stack__ } = this;

      if (!__mlo_refs__) return super.observe(target, options);

      const elRef = ref(target);

      elRef.labels.add('observer');
      elRef.labels.add('resize');
      elRef.stacks.push(__mlo_stack__);

      __mlo_refs__.cb.linkTo(elRef);
      __mlo_refs__.ob.linkTo(elRef);

      return super.observe(target, options);
    }

    disconnect(): void {
      delete this.__mlo_refs__;
      return super.disconnect();
    }
  }

  Object.defineProperty(MloResizeObserver.prototype, '__mlo_class__', {
    value: 'ResizeObserver',
    writable: false,
    configurable: false,
    enumerable: false,
  });

  globalThis.ResizeObserver = MloResizeObserver;

  return () => {
    globalThis.ResizeObserver = NativeResizeObserver;
  };
}

function MonitorMutationObserver() {
  class MloMutationObserver extends NativeMutationObserver {
    private __mlo_refs__?: {
      cb: MloRef<object>;
      ob: MloRef<object>;
    };

    private __mlo_stack__!: MloObjectStack;

    constructor(callback: MutationCallback) {
      super(callback);

      const stack = {
        type: `MutationObserver`,
        stack: captureStack(callback, 1)!,
        at: Date.now(),
      };

      const cbRef = ref(callback);
      cbRef.name = 'MutationObserver.callback';
      cbRef.labels.add('observer-callback');

      const obRef = ref(this);

      obRef.name = 'MutationObserver';
      cbRef.type = 'MutationObserver';
      obRef.labels.add('observer');

      cbRef.linkTo(obRef);

      Object.defineProperties(this, {
        __mlo_refs__: writable({ cb: cbRef, ob: obRef }),
        __mlo_stack__: constant(stack),
      });
    }

    observe(target: Element, options?: MutationObserverInit): void {
      const { __mlo_refs__, __mlo_stack__ } = this;

      if (!__mlo_refs__) return super.observe(target, options);

      const elRef = ref(target);

      elRef.labels.add('observer');
      elRef.labels.add('mutation');

      elRef.stacks.push(__mlo_stack__);

      __mlo_refs__.cb.linkTo(elRef);
      __mlo_refs__.ob.linkTo(elRef);

      return super.observe(target, options);
    }

    disconnect(): void {
      delete this.__mlo_refs__;
      return super.disconnect();
    }
  }

  Object.defineProperty(MloMutationObserver.prototype, '__mlo_class__', {
    value: 'MutationObserver',
    writable: false,
    configurable: false,
    enumerable: false,
  });

  globalThis.MutationObserver = MloMutationObserver;

  return () => {
    globalThis.MutationObserver = NativeMutationObserver;
  };
}
