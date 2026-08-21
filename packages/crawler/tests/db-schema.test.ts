import { describe, expect, it } from 'bun:test';

import { resolveModelName } from '../src/db/schema.js';

describe('resolveModelName', () => {
  it('无 modelName 时用 schema 键名', () => {
    expect(resolveModelName({ users: { fields: {} } }, 'users')).toBe('users');
  });

  it('有 modelName 时优先用', () => {
    expect(resolveModelName({ users: { modelName: 't_users', fields: {} } }, 'users')).toBe(
      't_users',
    );
  });
});
