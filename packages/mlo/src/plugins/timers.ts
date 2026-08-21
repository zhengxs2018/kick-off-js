import {
  ref,
  isFunction,
  NativeSetInterval,
  noop,
  NativeSetTimeout,
  isNil,
  inBrowser,
  captureStack,
} from '../base/index.js';
import type { MloPluginObject } from '../types/plugin.js';

const TIMEOUT_DEFAULT_TIME = 10000;

export function timers(options?: TimersOptions): MloPluginObject {
  return {
    name: 'timers',
    setup({ subscriptions }) {
      // 无法 hack nodejs 环境下的定时器，因此在非浏览器环境中不启用该插件
      if (inBrowser === false) {
        console.debug(
          '[mlo] timers plugin is designed to work in browser environment, skipping setup.',
        );
        return;
      }

      subscriptions.push(
        MonitorInterval(resolveOptions(options?.interval)),
        MonitorTimeout(resolveOptions(options?.timeout)),
      );
    },
  };

  function resolveOptions(options?: boolean | number | TimerOptions): Required<TimerOptions> {
    if (options === false || isNil(options)) {
      return { enable: false, time: TIMEOUT_DEFAULT_TIME };
    }

    if (options === true) {
      return { enable: true, time: TIMEOUT_DEFAULT_TIME };
    }

    if (typeof options === 'number') {
      return { enable: true, time: options };
    }

    return {
      enable: options.enable === true,
      time: options.time ?? TIMEOUT_DEFAULT_TIME,
    };
  }
}

function MonitorTimeout({ enable, time }: Required<TimerOptions>) {
  if (!enable) return noop;

  // @ts-expect-error ignore type error of setTimeout
  globalThis.setTimeout = function (
    handler: TimerHandler,
    timeout: number,
    ...args: any[]
  ): number | NodeJS.Timeout {
    if (isFunction(handler) && timeout > time) {
      const timeoutRef = ref(handler);

      if (timeoutRef) {
        timeoutRef.name = 'setTimeout';
        timeoutRef.labels.add('timer');
        timeoutRef.labels.add('timeout');

        timeoutRef.stacks.push({
          type: `setTimeout(${timeout})`,
          stack: captureStack(handler, 1)!,
          at: Date.now(),
        });
      }
    }

    // @ts-expect-error ignore type error of setTimeout
    return NativeSetTimeout.call(this, handler, timeout, ...args);
  };

  return () => {
    globalThis.setTimeout = NativeSetTimeout;
  };
}

function MonitorInterval({ enable, time }: Required<TimerOptions>) {
  if (!enable) return noop;

  // @ts-expect-error ignore type error of setInterval
  globalThis.setInterval = function (
    handler: TimerHandler,
    timeout: number,
    ...args: any[]
  ): number | NodeJS.Timeout {
    if (isFunction(handler) && timeout > time) {
      const intervalRef = ref(handler);

      if (intervalRef) {
        intervalRef.name = 'setInterval';
        intervalRef.labels.add('timer');
        intervalRef.labels.add('interval');
        intervalRef.stacks.push({
          type: `setInterval(${timeout})`,
          stack: captureStack(handler, 1)!,
          at: Date.now(),
        });
      }
    }

    // @ts-expect-error ignore type error of setInterval
    return NativeSetInterval.call(this, handler, timeout, ...args);
  };

  return () => {
    globalThis.setInterval = NativeSetInterval;
  };
}

export type TimersOptions = {
  /**
   * 是否监控定时器的调用，或者监控的最小超时时间，单位毫秒
   *
   * - 如果为 `true`，则监控所有定时器的调用；
   * - 如果为 `false` 或 `undefined`，则不监控定时器的调用；
   * - 如果为数字，则监控超时时间大于该值的定时器调用；
   * - 如果为对象，则根据对象的属性进行配置
   *
   * @defaultValue 10000
   */
  interval?: boolean | number | TimerOptions;

  /**
   * 是否监控定时器的调用，或者监控的最小超时时间，单位毫秒
   *
   * - 如果为 `true`，则监控所有定时器的调用；
   * - 如果为 `false` 或 `undefined`，则不监控定时器的调用；
   * - 如果为数字，则监控超时时间大于该值的定时器调用；
   * - 如果为对象，则根据对象的属性进行配置
   *
   * @defaultValue 10000
   */
  timeout?: boolean | number | TimerOptions;
};

export type TimerOptions = {
  /**
   * 是否监控定时器的调用
   */
  enable?: boolean;

  /**
   * 跟踪的最小超时时间，单位毫秒
   */
  time?: number;
};
