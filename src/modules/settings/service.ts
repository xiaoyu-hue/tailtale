import {
  AI_CONFIG_KEY,
  BACKUP_VERSION,
  DEFAULT_FONT_SIZE_INDEX,
  FONT_SIZES,
  builtinBookIds,
  clampFontSizeIndex,
  defaultSettings,
  envelopePayload,
  filterBooksForRestore,
  filterContentsForBackup,
  isBackupEnvelope,
  isThemeChoice,
  isUiSkin,
  parseBackupBundle,
  type BackupBundle,
  type BackupEnvelope,
  type Settings,
} from './model';
import { BackupCryptoError, decryptText, encryptText } from '../../platform/crypto/backup-crypto';
import { run, STORE_BOOKS, STORE_CONTENTS, STORE_WALLET, STORE_CHECKINS, STORE_READING_SESSION, STORE_PET } from '../../platform/db';

/** 参与备份的 IndexedDB store 列表（顺序无关，全部读出再写回）。 */
const BACKUP_STORES = [
  STORE_BOOKS,
  STORE_CONTENTS,
  STORE_WALLET,
  STORE_CHECKINS,
  STORE_READING_SESSION,
  STORE_PET,
] as const;

const SETTINGS_KEY = 'tailtale:settings';
/** M1 阅读器写入的旧字号键（px 值），首次加载时迁移进新结构后删除。 */
const LEGACY_FONT_SIZE_KEY = 'tailtale:fontSize';
/** 允许写回的 localStorage 键白名单（应用实际使用的全部 tailtale:* 键）。
 * 恢复备份时仅放开这两个键，拒绝伪造/损坏备份注入的未知键（避免污染未来功能读取）。
 * 若 ai 模块新增本地键，须在此同步登记。 */
const ALLOWED_LOCAL_KEYS = new Set<string>([SETTINGS_KEY, AI_CONFIG_KEY]);

function migrateLegacy(): Partial<Settings> {
  const legacy = window.localStorage.getItem(LEGACY_FONT_SIZE_KEY);
  if (!legacy) return {};
  window.localStorage.removeItem(LEGACY_FONT_SIZE_KEY); // 迁移即清理，不留双写源
  const px = Number(legacy);
  const index = FONT_SIZES.findIndex((size) => size === px);
  return index >= 0 ? { fontSizeIndex: index } : {};
}

/** 读取设置（同步）：localStorage 是设备本地偏好，不需要 IndexedDB。 */
export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        fontSizeIndex: clampFontSizeIndex(parsed.fontSizeIndex ?? DEFAULT_FONT_SIZE_INDEX),
        theme: isThemeChoice(parsed.theme) ? parsed.theme : defaultSettings().theme,
        skin: isUiSkin(parsed.skin) ? parsed.skin : defaultSettings().skin,
        // v1.7.0 新增字段：旧设置无此键 → 默认 false（保持动画开启）
        reduceMotion: parsed.reduceMotion === true,
      };
    }
    const base = defaultSettings();
    const migrated = migrateLegacy();
    if (Object.keys(migrated).length === 0) return base;
    const settings = { ...base, ...migrated };
    saveSettings(settings); // 迁移结果立即落库，否则下次读取即丢失
    return settings;
  } catch (error) {
    console.error('读取设置失败，使用默认值', error);
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('保存设置失败', error);
  }
}

// ============ 数据备份（M6） ============

/** 收集全量本地数据，组装为备份包。 */
export async function collectBackup(): Promise<BackupBundle> {
  const stores: Record<string, unknown[]> = {};
  // 内置书（source=builtin）内容不进备份：可随时从书库重新领取（M7 策略）。
  // books 在 BACKUP_STORES 中位于 contents 之前，先读到 books 即可拿到内置书 id 集合。
  let builtinIds: Set<string> = new Set();
  for (const name of BACKUP_STORES) {
    try {
      const rows = await run<unknown[]>(name, 'readonly', (s) => s.getAll());
      const all = rows ?? [];
      if (name === STORE_BOOKS) {
        builtinIds = builtinBookIds(all);
        stores[name] = all;
      } else if (name === STORE_CONTENTS) {
        stores[name] = filterContentsForBackup(all, builtinIds);
      } else {
        stores[name] = all;
      }
    } catch (error) {
      console.error(`读取 store ${name} 失败`, error);
      stores[name] = [];
    }
  }
  const localStorage: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith('tailtale:')) {
      const value = window.localStorage.getItem(key);
      if (value !== null) localStorage[key] = value;
    }
  }
  return {
    app: 'tailtale',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
    localStorage,
  };
}

/** 把备份包写回本地存储（覆盖式：先清后写，导入即覆盖）。 */
export async function restoreBackup(bundle: BackupBundle): Promise<void> {
  // 仅恢复「已知 store」：伪造/损坏备份中的未知 store 名一律忽略，避免打开不存在的事务或污染未来 store。
  for (const name of BACKUP_STORES) {
    const rows = bundle.stores[name];
    if (!Array.isArray(rows)) continue;
    // 内置书不恢复：内容不在备份中，恢复后按需重新领取（M7 策略）
    const target = name === STORE_BOOKS ? filterBooksForRestore(rows) : rows;
    try {
      await run(name, 'readwrite', (s) => {
        const req = s.clear();
        for (const row of target) s.put(row as never);
        // 返回最后一个 put 的 request 供 run 等待（clear 后所有 put 在同一事务内排队）
        return target.length > 0 ? (s.put(target[target.length - 1] as never) as IDBRequest) : req;
      });
    } catch (error) {
      console.error(`恢复 store ${name} 失败`, error);
    }
  }
  // 先清除白名单键（清掉目标设备上的旧值），再写回备份值，保证 settings/ai 与备份完全一致，
  // 避免目标设备残留的旧键污染恢复结果。
  for (const key of ALLOWED_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`清除 localStorage ${key} 失败`, error);
    }
  }
  // 仅恢复「白名单键」：备份只应写回应用实际使用的 tailtale:* 键，
  // 拒绝伪造/损坏备份注入的未知键（如将来某功能读取的键被旧/恶意备份污染）。
  for (const [key, value] of Object.entries(bundle.localStorage)) {
    if (!ALLOWED_LOCAL_KEYS.has(key)) continue;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.error(`恢复 localStorage ${key} 失败`, error);
    }
  }
}

/** 备份文件名：按导出日期，明文与加密备份同名（内容自识别）。 */
function backupFileName(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `tailtale-backup-${stamp}.json`;
}

/** 触发浏览器下载 JSON 文件（明文备份与加密信封共用）。 */
function downloadJson(data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backupFileName();
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** 导出明文备份文件。 */
export function exportBackupToFile(bundle: BackupBundle): void {
  downloadJson(bundle);
}

/**
 * 收集全量数据并加密导出（加密备份档，v1.11.0）：整个备份文件加密，
 * 口令只用于本次密钥派生、不落任何存储；环境不支持 WebCrypto 时抛 BackupCryptoError。
 */
export async function exportEncryptedBackupToFile(password: string): Promise<void> {
  const bundle = await collectBackup();
  const payload = await encryptText(JSON.stringify(bundle), password);
  const envelope: BackupEnvelope = {
    app: 'tailtale',
    encrypted: true,
    version: BACKUP_VERSION,
    exportedAt: bundle.exportedAt,
    kdf: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations: payload.iterations, salt: payload.salt },
    cipher: { algorithm: 'AES-GCM', iv: payload.iv },
    ciphertext: payload.ciphertext,
  };
  downloadJson(envelope);
}

/**
 * 读取备份文件并分类（只读文件 + JSON 解析，不触碰存储）：
 *  - plain：明文备份包，可直接恢复；
 *  - encrypted：加密信封，交由 UI 收口令后走 importEncryptedBackup；
 *  - ok:false：带中文错误原因。
 */
export async function readBackupFile(
  file: File
): Promise<
  | { ok: true; kind: 'plain'; bundle: BackupBundle }
  | { ok: true; kind: 'encrypted'; envelope: BackupEnvelope }
  | { ok: false; error: string }
> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: '文件不是合法的 JSON' };
  }
  if (isBackupEnvelope(data)) return { ok: true, kind: 'encrypted', envelope: data };
  const parsed = parseBackupBundle(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, kind: 'plain', bundle: parsed.bundle };
}

/**
 * 解密加密备份并写回本地（覆盖式）。口令错误 / 文件被篡改 → ok:false。
 * 解密内容仍过一次 parseBackupBundle 形状校验，防止伪造内容注入。
 */
export async function importEncryptedBackup(
  envelope: BackupEnvelope,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  let plaintext: string;
  try {
    plaintext = await decryptText(envelopePayload(envelope), password);
  } catch (error) {
    if (error instanceof BackupCryptoError) return { ok: false, error: error.message };
    return { ok: false, error: '解密失败，请确认文件格式' };
  }
  const parsed = parseBackupBundle(plaintext);
  if (!parsed.ok) return { ok: false, error: `解密成功但备份内容无效：${parsed.error}` };
  await restoreBackup(parsed.bundle);
  return { ok: true };
}
