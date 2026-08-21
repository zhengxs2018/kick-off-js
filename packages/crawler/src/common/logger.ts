export function createLogger(name: string): Logger {
  return {
    info(...args: unknown[]): void {
      console.log('[%s]', name, ...args);
    },
    warn(...args: unknown[]): void {
      console.warn('[%s]', name, ...args);
    },
    error(...args: unknown[]): void {
      console.error('[%s]', name, ...args);
    },
    debug(...args: unknown[]): void {
      console.log('[%s]', name, ...args);
    },
  };
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}
