/**
 * 备份加密原语单元测试（node:test，零新依赖；Node ≥19 全局 WebCrypto）。
 * 运行：npm run test（先把 src/platform/crypto/backup-crypto.ts 编译到 .test-dist/）。
 * 覆盖：加密解密往返、盐/IV 随机化、错误口令、密文篡改（GCM 认证标签）、
 *       base64 损坏、迭代次数非法、信封全链路闭环（加密 → 信封 → 解密 → 备份解析）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptText,
  decryptText,
  BackupCryptoError,
  PBKDF2_ITERATIONS,
} from '../.test-dist/platform/crypto/backup-crypto.js';
import {
  BACKUP_VERSION,
  isBackupEnvelope,
  envelopePayload,
  parseBackupBundle,
} from '../.test-dist/settings/model.js';

/** 测试用小迭代次数（提速）；生产参数由末尾「生产迭代次数」用例单独验证。 */
const FAST_ITERATIONS = 1000;
const password = 'correct-horse-battery-staple';

/** 构造一个合法加密信封（与 service.ts exportEncryptedBackupToFile 同构）。 */
async function buildEnvelope(plaintext, pass) {
  const payload = await encryptText(plaintext, pass, FAST_ITERATIONS);
  return {
    app: 'tailtale',
    encrypted: true,
    version: BACKUP_VERSION,
    exportedAt: '2026-10-23T00:00:00.000Z',
    kdf: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations: payload.iterations, salt: payload.salt },
    cipher: { algorithm: 'AES-GCM', iv: payload.iv },
    ciphertext: payload.ciphertext,
  };
}

test('加密 → 解密往返：明文一致，负载字段齐全且迭代次数正确', async () => {
  const plaintext = JSON.stringify({ app: 'tailtale', localStorage: { 'tailtale:ai': '{"key":"sk-abc"}' } });
  const payload = await encryptText(plaintext, password, FAST_ITERATIONS);
  assert.equal(payload.iterations, FAST_ITERATIONS);
  assert.ok(payload.salt.length > 0);
  assert.ok(payload.iv.length > 0);
  assert.ok(payload.ciphertext.length > 0);
  const back = await decryptText(payload, password);
  assert.equal(back, plaintext);
});

test('同一口令加密同一明文两次：盐 / IV / 密文均不同（随机化，抗彩虹表）', async () => {
  const a = await encryptText('same-plaintext', password, FAST_ITERATIONS);
  const b = await encryptText('same-plaintext', password, FAST_ITERATIONS);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
  // 但都能用同一口令解密回同一明文
  assert.equal(await decryptText(a, password), 'same-plaintext');
  assert.equal(await decryptText(b, password), 'same-plaintext');
});

test('错误口令 → bad-password（GCM 认证标签校验失败）', async () => {
  const payload = await encryptText('secret', password, FAST_ITERATIONS);
  await assert.rejects(
    decryptText(payload, 'wrong-password'),
    (error) => {
      assert.ok(error instanceof BackupCryptoError);
      assert.equal(error.reason, 'bad-password');
      return true;
    }
  );
});

test('篡改密文一个字节 → bad-password（认证标签生效，与错口令同因呈现）', async () => {
  const payload = await encryptText('secret', password, FAST_ITERATIONS);
  const bytes = Uint8Array.from(atob(payload.ciphertext), (c) => c.charCodeAt(0));
  bytes[0] ^= 0xff;
  const tampered = { ...payload, ciphertext: btoa(String.fromCharCode(...bytes)) };
  await assert.rejects(
    decryptText(tampered, password),
    (error) => error instanceof BackupCryptoError && error.reason === 'bad-password'
  );
});

test('密文 base64 损坏 → corrupted（解密前即可识别）', async () => {
  const payload = await encryptText('secret', password, FAST_ITERATIONS);
  await assert.rejects(
    decryptText({ ...payload, ciphertext: '!!!not-base64!!!' }, password),
    (error) => error instanceof BackupCryptoError && error.reason === 'corrupted'
  );
});

test('迭代次数非法（0）→ corrupted', async () => {
  const payload = await encryptText('secret', password, FAST_ITERATIONS);
  await assert.rejects(
    decryptText({ ...payload, iterations: 0 }, password),
    (error) => error instanceof BackupCryptoError && error.reason === 'corrupted'
  );
});

test('信封全链路闭环：加密 → 信封 → 形状校验 → 取参 → 解密 → 备份解析，内容与原包一致', async () => {
  const bundle = {
    app: 'tailtale',
    version: BACKUP_VERSION,
    exportedAt: '2026-10-23T00:00:00.000Z',
    stores: { books: [{ id: 'imp1' }], wallet: [{ id: 'wallet', coins: 10 }] },
    localStorage: { 'tailtale:settings': '{"theme":"dark"}', 'tailtale:ai': '{"key":"sk-abc"}' },
  };
  const envelope = await buildEnvelope(JSON.stringify(bundle), password);
  assert.equal(isBackupEnvelope(envelope), true);
  const plaintext = await decryptText(envelopePayload(envelope), password);
  const parsed = parseBackupBundle(plaintext);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.bundle, bundle);
    // 加密备份默认含密钥（明文档由 UI 侧 stripAiKey 剔除，不经过本链路）
    assert.equal(typeof parsed.bundle.localStorage['tailtale:ai'], 'string');
  }
});

test('生产迭代次数（OWASP 建议值）真实跑通一遍往返', async () => {
  assert.equal(PBKDF2_ITERATIONS, 600_000);
  const payload = await encryptText('production-param-check', password);
  assert.equal(await decryptText(payload, password), 'production-param-check');
});
