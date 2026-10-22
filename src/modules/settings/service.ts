import {
  BACKUP_VERSION,
  DEFAULT_FONT_SIZE_INDEX,
  FONT_SIZES,
  clampFontSizeIndex,
  defaultSettings,
  isThemeChoice,
  isUiSkin,
  parseBackupBundle,
  type BackupBundle,
  type Settings,
} from './model';
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
  for (const name of BACKUP_STORES) {
    try {
      const rows = await run<unknown[]>(name, 'readonly', (s) => s.getAll());
      stores[name] = rows ?? [];
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
  for (const [name, rows] of Object.entries(bundle.stores)) {
    if (!Array.isArray(rows)) continue;
    try {
      await run(name, 'readwrite', (s) => {
        const req = s.clear();
        for (const row of rows) s.put(row as never);
        // 返回最后一个 put 的 request 供 run 等待（clear 后所有 put 在同一事务内排队）
        return rows.length > 0 ? (s.put(rows[rows.length - 1] as never) as IDBRequest) : req;
      });
    } catch (error) {
      console.error(`恢复 store ${name} 失败`, error);
    }
  }
  for (const [key, value] of Object.entries(bundle.localStorage)) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.error(`恢复 localStorage ${key} 失败`, error);
    }
  }
}

/** 触发浏览器下载备份 JSON 文件。 */
export function exportBackupToFile(bundle: BackupBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `tailtale-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** 读取并恢复用户选择的备份文件；返回失败原因（ok:false）供 UI 提示。 */
export async function importBackupFromFile(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = await file.text();
  const parsed = parseBackupBundle(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  await restoreBackup(parsed.bundle);
  return { ok: true };
}
