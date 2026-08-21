import { describe, expect, it } from 'bun:test';

import {
  CrawlerError,
  HttpError,
  HttpStatusError,
  SchemaValidationError,
  UnknownTaskError,
  isCrawlerError,
  isHttpError,
  isHttpStatusError,
  isSchemaValidationError,
  isUnknownTaskError,
} from '../src/common/errors.js';

describe('错误 brand 判定（不用 instanceof 跨 realm 安全）', () => {
  it('CrawlerError 被 isCrawlerError 识别', () => {
    const e = new CrawlerError('x');
    expect(isCrawlerError(e)).toBe(true);
    expect(e.__is_crawler_error).toBe(true);
  });

  it('HttpError 同时是 CrawlerError', () => {
    const e = new HttpError('net', 408);
    expect(isHttpError(e)).toBe(true);
    expect(isCrawlerError(e)).toBe(true);
  });

  it('HttpStatusError 携带 status/statusText/url 且被多层判定识别', () => {
    const e = new HttpStatusError(500, 'Internal', 'https://x.test');
    expect(isHttpStatusError(e)).toBe(true);
    expect(isHttpError(e)).toBe(true);
    expect(isCrawlerError(e)).toBe(true);
    expect(e.status).toBe(500);
    expect(e.statusText).toBe('Internal');
    expect(e.url).toBe('https://x.test');
  });

  it('UnknownTaskError 被 isUnknownTaskError 识别', () => {
    const e = new UnknownTaskError('t');
    expect(isUnknownTaskError(e)).toBe(true);
    expect(isCrawlerError(e)).toBe(true);
  });

  it('SchemaValidationError 携带 issues/cause 且被 isSchemaValidationError 识别', () => {
    const issues = [{ message: 'bad' }];
    const cause = { foo: 1 };
    const e = new SchemaValidationError(issues, cause);
    expect(isSchemaValidationError(e)).toBe(true);
    expect(isCrawlerError(e)).toBe(true);
    expect(e.issues).toBe(issues);
    expect(e.cause).toBe(cause);
    expect(e.message).toContain('bad');
  });

  it('普通 Error / 非 Error 不被任何 crawlers 判定识别', () => {
    const sysErr = new Error('system');
    expect(isCrawlerError(sysErr)).toBe(false);
    expect(isHttpError(sysErr)).toBe(false);
    expect(isSchemaValidationError(sysErr)).toBe(false);
    expect(isUnknownTaskError(sysErr)).toBe(false);
    expect(isCrawlerError('string')).toBe(false);
    expect(isCrawlerError(null)).toBe(false);
    expect(isCrawlerError(undefined)).toBe(false);
  });

  it('HttpStatusError 不是 UnknownTaskError', () => {
    const e = new HttpStatusError(404, 'Not Found', 'https://x.test');
    expect(isUnknownTaskError(e)).toBe(false);
  });
});
