import { isObject } from './utils.js';

/**
 * 爬虫内部错误的统一基类。判定用 brand 字段（非 instanceof），避免跨 realm / 多副本失效。
 * 所有爬虫自有错误均继承此类，便于外部统一区分「内部报错」与「系统/JS 报错」。
 */
export class CrawlerError extends Error {
  readonly __is_crawler_error = true;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CrawlerError';
  }
}

/** 判断是否为 crawler 内部错误（含子类） */
export function isCrawlerError(error: unknown): error is CrawlerError {
  return isObject(error) && error.__is_crawler_error === true;
}

/**
 * HTTP 层错误：网络失败、非 2xx 状态码等。继承 `CrawlerError`（故 `isCrawlerError` 亦为真），
 * 并带独立 brand，外部可用 `isHttpError` 收窄到 HTTP 维度。
 */
export class HttpError extends CrawlerError {
  readonly __is_http_error = true;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'HttpError';
  }
}

/** 判断是否为 HTTP 层错误（含子类） */
export function isHttpError(error: unknown): error is HttpError {
  return isObject(error) && error.__is_http_error === true;
}

/**
 * HTTP 状态码错误：服务端返回非 2xx。携带 `status` / `statusText` / `url`，
 * 供 caller 做重试或降级决策。
 */
export class HttpStatusError extends HttpError {
  /** 响应状态码（非 2xx） */
  readonly status: number;
  /** 响应状态文本 */
  readonly statusText: string;
  /** 触发错误的请求 URL */
  readonly url: string;

  /**
   * @param status - 响应状态码
   * @param statusText - 响应状态文本
   * @param url - 请求 URL
   */
  constructor(status: number, statusText: string, url: string) {
    super(`HTTP ${status} ${statusText} for '${url}'`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
  }
}

/** 判断是否为 HTTP 状态码错误 */
export function isHttpStatusError(error: unknown): error is HttpStatusError {
  return isObject(error) && error.__is_http_error === true && typeof error.status === 'number';
}

/**
 * 未知 task 错误：spider 路由到未声明 task 时抛出，由调度层捕获后标记 queue item 失败。
 * 继承 `CrawlerError`（故 `isCrawlerError` 亦为真）。
 */
export class UnknownTaskError extends CrawlerError {
  readonly __is_unknown_task_error = true;
  /** 有问题的 task 名 */
  readonly task: string;
  /** 所属 spider 名 */
  readonly spider: string;

  /**
   * @param task - 未声明的 task 名
   * @param spider - 所属 spider 名
   */
  constructor(task: string, spider: string) {
    super(`Unknown task '${task}' for spider '${spider}'`);
    this.name = 'UnknownTaskError';
    this.task = task;
    this.spider = spider;
  }
}

/** 判断是否为未知 task 错误 */
export function isUnknownTaskError(error: unknown): error is UnknownTaskError {
  return isObject(error) && error.__is_unknown_task_error === true;
}

/**
 * Schema 校验失败时抛出
 */
export class SchemaValidationError extends CrawlerError {
  readonly __is_schema_validation_error = true;
  readonly issues: ReadonlyArray<{
    readonly message: string;
    readonly path?: ReadonlyArray<string | number>;
  }>;
  readonly cause: unknown;

  constructor(
    issues: ReadonlyArray<{
      readonly message: string;
      readonly path?: ReadonlyArray<string | number>;
    }>,
    cause: unknown,
  ) {
    super(`Schema validation failed: ${issues.map(i => i.message).join('; ')}`);
    this.name = 'SchemaValidationError';
    this.issues = issues;
    this.cause = cause;
  }
}

export function isSchemaValidationError(error: unknown): error is SchemaValidationError {
  return isObject(error) && error.__is_schema_validation_error === true;
}
