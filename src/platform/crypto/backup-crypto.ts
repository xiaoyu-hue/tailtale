/**
 * 平台能力：备份加密原语（v1.11.0）。
 *
 * 浏览器原生 WebCrypto，零第三方依赖（延续「能自己写的绝不引依赖」原则）：
 *   PBKDF2-HMAC-SHA256 从用户口令派生密钥（迭代次数见 PBKDF2_ITERATIONS）；
 *   AES-256-GCM 加密——GCM 自带认证标签，「口令错误」与「文件被篡改」会以同一失败呈现
 *   （安全上不区分，UI 文案合并为「口令错误或备份文件已被篡改」）。
 *
 * 运行环境：浏览器需安全上下文（HTTPS / localhost；本站 Cloudflare Pages 满足），
 *   否则 crypto.subtle 不存在，抛 unsupported；Node ≥ 19 全局 crypto 可直接跑单测。
 *
 * 分层：本文件只做「文本 ↔ base64 负载」原语；备份信封（envelope）的形状与校验
 *   在 settings/model.ts（纯函数、可单测）；收集/写回/下载在 settings/service.ts。
 */

/** PBKDF2 迭代次数：OWASP Password Storage Cheat Sheet（2025）对 PBKDF2-HMAC-SHA-256 的最小建议值。 */
export const PBKDF2_ITERATIONS = 600_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;

/**
 * 解密失败原因：
 *  - bad-password：口令错误或密文被篡改（GCM 认证失败，二者无法区分，刻意合并）；
 *  - corrupted：信封字段合法但内容无法解析（base64 损坏、迭代次数非法等）；
 *  - unsupported：运行环境不支持 WebCrypto。
 */
export type DecryptFailure = 'bad-password' | 'corrupted' | 'unsupported';

export class BackupCryptoError extends Error {
  readonly reason: DecryptFailure;
  constructor(reason: DecryptFailure, message: string) {
    super(message);
    this.name = 'BackupCryptoError';
    this.reason = reason;
  }
}

/** 加密输出：base64 编码的盐 / IV / 密文（密文含 GCM 认证标签）+ 迭代次数，供信封组装。 */
export interface EncryptedPayload {
  salt: string;
  iv: string;
  iterations: number;
  ciphertext: string;
}

function subtleCrypto(): SubtleCrypto {
  const webcrypto = globalThis.crypto;
  if (!webcrypto || !webcrypto.subtle) {
    throw new BackupCryptoError('unsupported', '当前环境不支持 WebCrypto（需要 HTTPS 或现代浏览器）');
  }
  return webcrypto.subtle;
}

function toBase64(bytes: Uint8Array): string {
  // 逐字节拼接，避免大文件 spread 传参触发调用栈上限（备份可达数 MB）
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  let binary: string;
  try {
    binary = atob(text);
  } catch {
    throw new BackupCryptoError('corrupted', '备份文件损坏（加密内容不是合法的 base64）');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const material = await subtleCrypto().importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtleCrypto().deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * 加密任意文本（备份 JSON 序列化后的字符串），返回 base64 负载。
 * iterations 默认取 OWASP 建议值；显式传值仅用于测试提速，生产代码不要覆盖。
 */
export async function encryptText(
  plaintext: string,
  password: string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<EncryptedPayload> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, iterations);
  const cipher = await subtleCrypto().encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    iterations,
    ciphertext: toBase64(new Uint8Array(cipher)),
  };
}

/** 解密负载为文本。口令错误或文件被篡改 → BackupCryptoError('bad-password')。 */
export async function decryptText(payload: EncryptedPayload, password: string): Promise<string> {
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);
  if (!Number.isInteger(payload.iterations) || payload.iterations < 1) {
    throw new BackupCryptoError('corrupted', '备份文件损坏（密钥派生参数非法）');
  }
  const key = await deriveKey(password, salt, payload.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await subtleCrypto().decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  } catch {
    throw new BackupCryptoError('bad-password', '口令错误或备份文件已被篡改');
  }
  return new TextDecoder().decode(plain);
}
