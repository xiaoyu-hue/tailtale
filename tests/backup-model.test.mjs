/**
 * settings 模块备份模型单元测试（node:test，零新依赖）。
 * 运行：npm run test（先把 pet/ai/settings 的 model.ts 编译到 .test-dist/ 再执行本文件）。
 * 覆盖：parseBackupBundle 对非法 JSON / 错误来源 / 版本过高 / 字段缺失 / 正常包的解析判定。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBackupBundle, BACKUP_VERSION } from '../.test-dist/settings/model.js';

const sampleBundle = {
  app: 'tailtale',
  version: BACKUP_VERSION,
  exportedAt: '2026-10-21T00:00:00.000Z',
  stores: { books: [{ id: 'b1' }], wallet: [{ id: 'wallet', coins: 10 }] },
  localStorage: { 'tailtale:settings': '{"theme":"dark"}' },
};

test('非法 JSON → 失败且给出原因', () => {
  const result = parseBackupBundle('{ not json');
  assert.equal(result.ok, false);
  assert.match(result.error, /JSON/);
});

test('非对象内容 → 失败', () => {
  const result = parseBackupBundle('123');
  assert.equal(result.ok, false);
});

test('来源不是 tailtale → 失败', () => {
  const result = parseBackupBundle(JSON.stringify({ app: 'other-app', version: 1, stores: {}, localStorage: {} }));
  assert.equal(result.ok, false);
  assert.match(result.error, /书时/);
});

test('版本过高 → 失败', () => {
  const result = parseBackupBundle(
    JSON.stringify({ app: 'tailtale', version: BACKUP_VERSION + 1, stores: {}, localStorage: {} })
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /版本/);
});

test('stores 字段缺失或非对象 → 失败', () => {
  assert.equal(parseBackupBundle(JSON.stringify({ app: 'tailtale', version: 1 })).ok, false);
  assert.equal(
    parseBackupBundle(JSON.stringify({ app: 'tailtale', version: 1, stores: [], localStorage: {} })).ok,
    false
  );
  assert.equal(
    parseBackupBundle(
      JSON.stringify({ app: 'tailtale', version: 1, stores: {}, localStorage: [] })
    ).ok,
    false
  );
});

test('正常备份包 → 成功并保留字段', () => {
  const result = parseBackupBundle(JSON.stringify(sampleBundle));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.bundle.app, 'tailtale');
    assert.equal(result.bundle.version, BACKUP_VERSION);
    assert.deepEqual(result.bundle.stores, sampleBundle.stores);
    assert.deepEqual(result.bundle.localStorage, sampleBundle.localStorage);
  }
});
