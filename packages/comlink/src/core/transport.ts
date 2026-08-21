/**
 * RPC 传输目标
 *
 * 适配：Window / MessagePort / WorkerGlobalScope
 */
export interface RpcTransport {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void,
    options?: AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void,
    options?: EventListenerOptions,
  ): void;
  /** 某些传输（如 MessagePort）需显式 start 才会投递消息；不需要的传输不实现该方法。 */
  start?(): void;
}
