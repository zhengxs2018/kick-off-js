import type { DisposeLike, EventListener } from '../base/common/events.js';
import type { MloObject } from './object.js';
import type { MloExtractPluginOptions, MloPlugin } from './plugin.js';
import type { MloRef } from './ref.js';
import type { MloStats } from './snapshot.js';

export interface MloData {
  stats: MloStats;
  items: MloObject[];
  timestamp: number;
}

export interface MloEvents {
  onElementAdded(
    listener: EventListener<Element>,
    options?: boolean | AddEventListenerOptions,
  ): DisposeLike;
  onElementRemoved(
    listener: EventListener<Element>,
    options?: boolean | AddEventListenerOptions,
  ): DisposeLike;
  onObjectObserve(
    listener: EventListener<MloRef>,
    options?: boolean | AddEventListenerOptions,
  ): DisposeLike;
  onObjectObserved(
    listener: EventListener<MloRef>,
    options?: boolean | AddEventListenerOptions,
  ): DisposeLike;
  onObjectUnobserved(
    listener: EventListener<MloRef>,
    options?: boolean | AddEventListenerOptions,
  ): DisposeLike;
  onObjectCollected(
    listener: EventListener<MloRef>,
    options?: boolean | AddEventListenerOptions,
  ): DisposeLike;
  onComponentMounted(
    listener: EventListener<unknown>,
    options?: boolean | AddEventListenerOptions,
  ): DisposeLike;
  onComponentUnmounted(
    listener: EventListener<unknown>,
    options?: boolean | AddEventListenerOptions,
  ): DisposeLike;
}

export type MloInstance = {
  readonly events: MloEvents;

  readonly disposed: boolean;

  use<P extends MloPlugin<any>>(plugin: P, options?: MloExtractPluginOptions<P>): void;

  get<T extends object>(source: T): MloRef<T> | undefined;

  key<T extends object>(id: number): MloRef<T> | undefined;

  values(predicate?: (ref: MloRef) => unknown): Generator<MloRef<object>, void, unknown>;

  observe: {
    (source: null | undefined): undefined;
    (source: string | number | boolean | bigint | symbol): undefined;
    (source: typeof globalThis): undefined;
    <T extends Function>(source: T): MloRef<T>;
    <T extends object>(source: T): MloRef<T>;
  };

  unobserve<T extends object>(source: T): MloRef<T> | undefined;

  flush(): number;

  takeRecords(predicate?: (ref: MloRef<object>) => unknown): MloRef<object>[];

  dispose(): void;

  toString(): string;

  toJSON(): MloData;

  [Symbol.dispose](): void;

  [Symbol.iterator](predicate?: (ref: MloRef) => unknown): Generator<MloRef<object>, void, unknown>;
};
