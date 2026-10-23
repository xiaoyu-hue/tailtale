/**
 * settings 模块备份模型单元测试（node:test，零新依赖）。
 * 运行：npm run test（先把 pet/ai/settings 的 model.ts 编译到 .test-dist/ 再执行本文件）。
 * 覆盖：parseBackupBundle 对非法 JSON / 错误来源 / 版本过高 / 字段缺失 / 正常包的解析判定。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBackupBundle, BACKUP_VERSION, isBuiltinBookRow, builtinBookIds, filterContentsForBackup, filterBooksForRestore, AI_CONFIG_KEY, backupContainsAiKey, stripAiKey, isBackupEnvelope, envelopePayload } from '../.test-dist/settings/model.js';

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

/* —— 内置公版书（M7）备份过滤 —— */

test('isBuiltinBookRow：仅 source==="builtin" 为真，旧数据（无 source）不受影响', () => {
  assert.equal(isBuiltinBookRow({ id: 'b1', source: 'builtin' }), true);
  assert.equal(isBuiltinBookRow({ id: 'b1' }), false); // 旧版导入书无 source 字段
  assert.equal(isBuiltinBookRow({ id: 'b1', source: 'import' }), false);
  assert.equal(isBuiltinBookRow(null), false);
  assert.equal(isBuiltinBookRow('b1'), false);
});

test('builtinBookIds：混合行只收集内置书 id，跳过无 id / id 非字符串', () => {
  const ids = builtinBookIds([
    { id: 'fp1', source: 'builtin' },
    { id: 'imp1' }, // 导入书，不收集
    { source: 'builtin' }, // 无 id，跳过
    { id: 99, source: 'builtin' }, // id 非字符串，跳过
    { id: 'fp2', source: 'builtin' },
  ]);
  assert.deepEqual([...ids].sort(), ['fp1', 'fp2']);
});

test('filterContentsForBackup：剔除内置书内容，导入书内容全保留', () => {
  const contents = [
    { id: 'fp1', text: '红楼梦全文' },
    { id: 'imp1', text: '我自己导入的书' },
    { id: 'imp2', text: '另一本导入书' },
  ];
  const kept = filterContentsForBackup(contents, new Set(['fp1']));
  assert.deepEqual(kept, [
    { id: 'imp1', text: '我自己导入的书' },
    { id: 'imp2', text: '另一本导入书' },
  ]);
});

test('filterBooksForRestore：剔除内置书行，导入书行全保留', () => {
  const books = [
    { id: 'fp1', title: '红楼梦', source: 'builtin' },
    { id: 'imp1', title: '我的书' },
    { id: 'imp2', title: '旧版书（无 source）' },
  ];
  const kept = filterBooksForRestore(books);
  assert.deepEqual(kept, [
    { id: 'imp1', title: '我的书' },
    { id: 'imp2', title: '旧版书（无 source）' },
  ]);
});

test('内置书不在备份中的闭环：备份体积与内容解耦，恢复后可重新领取', () => {
  // 模拟一次完整导出：books 含 1 内置 + 2 导入；contents 仅导入书内容
  const bookRows = [
    { id: 'fp1', source: 'builtin' },
    { id: 'imp1' },
    { id: 'imp2' },
  ];
  const builtinIds = builtinBookIds(bookRows);
  assert.equal(builtinIds.size, 1);
  const contentRows = [{ id: 'imp1', text: '…' }, { id: 'imp2', text: '…' }];
  const backupContents = filterContentsForBackup(contentRows, builtinIds);
  assert.equal(backupContents.length, 2); // 备份里没有内置书内容
  const restoredBooks = filterBooksForRestore(bookRows);
  assert.equal(restoredBooks.length, 2); // 恢复后内置书行被跳过
});

/* —— 导出档位（v1.10.0）：AI 密钥识别与剔除 —— */

test('backupContainsAiKey：有有效密钥为真；缺失 / 空串 / 非法 JSON 为假', () => {
  const withKey = { localStorage: { [AI_CONFIG_KEY]: '{"key":"sk-abc","model":"deepseek-chat"}' } };
  const emptyKey = { localStorage: { [AI_CONFIG_KEY]: '{"key":""}' } };
  const noKeyField = { localStorage: { [AI_CONFIG_KEY]: '{"model":"deepseek-chat"}' } };
  const broken = { localStorage: { [AI_CONFIG_KEY]: 'not-json' } };
  const missing = { localStorage: { 'tailtale:settings': '{}' } };
  assert.equal(backupContainsAiKey(withKey), true);
  assert.equal(backupContainsAiKey(emptyKey), false);
  assert.equal(backupContainsAiKey(noKeyField), false);
  assert.equal(backupContainsAiKey(broken), false);
  assert.equal(backupContainsAiKey(missing), false);
});

test('stripAiKey：剔除 tailtale:ai，其余 localStorage 键与 stores 原样保留', () => {
  const bundle = {
    app: 'tailtale',
    version: BACKUP_VERSION,
    exportedAt: '2026-10-23T00:00:00.000Z',
    stores: { books: [{ id: 'imp1' }] },
    localStorage: { 'tailtale:settings': '{"theme":"dark"}', [AI_CONFIG_KEY]: '{"key":"sk-abc"}' },
  };
  const stripped = stripAiKey(bundle);
  assert.equal(AI_CONFIG_KEY in stripped.localStorage, false);
  assert.deepEqual(stripped.localStorage, { 'tailtale:settings': '{"theme":"dark"}' });
  assert.deepEqual(stripped.stores, bundle.stores); // 非 localStorage 数据不受影响
  // 不修改原对象（纯函数）
  assert.equal(AI_CONFIG_KEY in bundle.localStorage, true);
});

test('stripAiKey：无密钥键时不影响其他数据（标准备份与旧备份行为一致）', () => {
  const bundle = {
    app: 'tailtale',
    version: BACKUP_VERSION,
    exportedAt: '',
    stores: {},
    localStorage: { 'tailtale:settings': '{}' },
  };
  const stripped = stripAiKey(bundle);
  assert.deepEqual(stripped.localStorage, { 'tailtale:settings': '{}' });
  assert.equal(backupContainsAiKey(stripped), false);
});

/* —— 加密备份信封（v1.11.0）：形状校验 —— */

const validEnvelope = {
  app: 'tailtale',
  encrypted: true,
  version: BACKUP_VERSION,
  exportedAt: '2026-10-23T00:00:00.000Z',
  kdf: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations: 600000, salt: 'c2FsdA==' },
  cipher: { algorithm: 'AES-GCM', iv: 'aXY=' },
  ciphertext: 'Y2lwaGVy',
};

test('isBackupEnvelope：合法信封为真', () => {
  assert.equal(isBackupEnvelope(validEnvelope), true);
});

test('isBackupEnvelope：明文包 / 非对象 / 缺字段 / 错算法均为假', () => {
  assert.equal(isBackupEnvelope({ app: 'tailtale', version: 1, stores: {}, localStorage: {} }), false); // 明文备份
  assert.equal(isBackupEnvelope(null), false);
  assert.equal(isBackupEnvelope('tailtale'), false);
  assert.equal(isBackupEnvelope({ ...validEnvelope, encrypted: false }), false);
  assert.equal(isBackupEnvelope({ ...validEnvelope, app: 'other' }), false);
  assert.equal(isBackupEnvelope({ ...validEnvelope, version: '1' }), false);
  assert.equal(isBackupEnvelope({ ...validEnvelope, exportedAt: 123 }), false);
  assert.equal(isBackupEnvelope({ ...validEnvelope, kdf: { ...validEnvelope.kdf, algorithm: 'scrypt' } }), false);
  assert.equal(isBackupEnvelope({ ...validEnvelope, kdf: { ...validEnvelope.kdf, hash: 'SHA-1' } }), false);
  assert.equal(isBackupEnvelope({ ...validEnvelope, cipher: { ...validEnvelope.cipher, algorithm: 'AES-CBC' } }), false);
  const { kdf, ...missingKdf } = validEnvelope;
  assert.equal(isBackupEnvelope(missingKdf), false);
  const { cipher, ...missingCipher } = validEnvelope;
  assert.equal(isBackupEnvelope(missingCipher), false);
  const { ciphertext, ...missingCiphertext } = validEnvelope;
  assert.equal(isBackupEnvelope(missingCiphertext), false);
});

test('envelopePayload：取出盐 / IV / 迭代次数 / 密文，与信封字段一致', () => {
  assert.deepEqual(envelopePayload(validEnvelope), {
    salt: 'c2FsdA==',
    iv: 'aXY=',
    iterations: 600000,
    ciphertext: 'Y2lwaGVy',
  });
});
