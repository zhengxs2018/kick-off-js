import type { RpcErrorResponse } from './schema.js';

/**
 * JSON-RPC 风格的结构化错误：携带数值 `code`、`message` 与可选 `data`。
 *
 * 与 `Error` 基类分离出 code/data 字段，使调用方既能按 `instanceof RpcError`
 * 识别，也能按 `error.code` 分支处理协议错误（-32601 方法未找到等）。
 * 参考 openai-node / MCP TypeScript SDK 的 `ProtocolError` 设计。
 */
export class RpcError extends Error {
  readonly code: number;

  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
    this.data = data;
  }

  /** 从 JSON-RPC 错误响应中提取并构造 RpcError。 */
  static fromResponse(error: RpcErrorResponse['error']): RpcError {
    return new RpcError(error.code, error.message, error.data);
  }

  /** 可读的多行格式化，便于日志输出（含 code / message / data）。 */
  format(): string {
    const lines = [`${this.name} [${this.code}]: ${this.message}`];
    if (this.data !== undefined) {
      lines.push(`  data: ${JSON.stringify(this.data)}`);
    }
    return lines.join('\n');
  }

  override toString(): string {
    return this.format();
  }
}
