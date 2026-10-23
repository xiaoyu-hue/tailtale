/**
 * settings 模块领域模型：全局偏好（正文字号、主题）。
 * 与 gamification 的 model 一样：纯数据 + 纯函数，可单测。
 */

/** 正文字号四档（px），与 M1 阅读器一致。 */
export const FONT_SIZES: readonly number[] = [16, 18, 20, 23];

/** 默认档位索引：18px（标准）。 */
export const DEFAULT_FONT_SIZE_INDEX = 1;

/** 最大档位索引（供 UI 判断能否继续增大）。 */
export const MAX_FONT_SIZE_INDEX = FONT_SIZES.length - 1;

export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_CHOICES: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

/** 界面皮肤（M6 主题皮肤）：default = 当前暖色主题；glass = 液态玻璃；pixel = 像素风。 */
export type UiSkin = 'default' | 'glass' | 'pixel';

/** 界面皮肤目录（设置页三选一；default 即不附加皮肤）。 */
export const THEME_SKINS: ReadonlyArray<{ value: UiSkin; label: string }> = [
  { value: 'default', label: '默认' },
  { value: 'glass', label: '液态玻璃' },
  { value: 'pixel', label: '像素风' },
];

export interface Settings {
  /** 字号档位索引（0..FONT_SIZES.length-1），存索引不存 px，档位调整时老设置不失效 */
  fontSizeIndex: number;
  /** 主题选择；auto = 跟随系统深浅色（默认，保持 M1 行为） */
  theme: ThemeChoice;
  /** 界面皮肤（M6 主题皮肤）；default = 不附加皮肤，沿用现有暖色主题 */
  skin: UiSkin;
  /** 减少动画（v1.7.0 总开关）：true = 全局关闭动画与过渡，等效系统「减少动态效果」 */
  reduceMotion: boolean;
}

export function defaultSettings(): Settings {
  return { fontSizeIndex: DEFAULT_FONT_SIZE_INDEX, theme: 'auto', skin: 'default', reduceMotion: false };
}

export function clampFontSizeIndex(index: number): number {
  if (!Number.isFinite(index)) return DEFAULT_FONT_SIZE_INDEX;
  return Math.min(Math.max(Math.round(index), 0), FONT_SIZES.length - 1);
}

/** 档位索引 → px 值（越界自动钳制，兜底默认档）。 */
export function fontSizeAt(index: number): number {
  const clamped = clampFontSizeIndex(index);
  return FONT_SIZES[clamped] ?? FONT_SIZES[DEFAULT_FONT_SIZE_INDEX];
}

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function isUiSkin(value: unknown): value is UiSkin {
  return value === 'default' || value === 'glass' || value === 'pixel';
}

// ============ 数据备份（M6）：纯函数层（可单测，零 DOM 依赖） ============

/** 备份包格式版本（与代码解耦，便于将来兼容旧备份）。 */
export const BACKUP_VERSION = 1;

/** 内置公版书（source=builtin）的备份策略（M7）：书籍元数据可随备份迁移，
 * 但内容不导出——内置书随时可从书库重新领取，导出全文只会让备份无谓膨胀。 */

/** 判断一行是否为内置书（books store 的行）。 */
export function isBuiltinBookRow(row: unknown): boolean {
  if (typeof row !== 'object' || row === null) return false;
  return (row as { source?: unknown }).source === 'builtin';
}

/** 从 books 行数组收集内置书 id 集合。 */
export function builtinBookIds(rows: unknown[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!isBuiltinBookRow(row)) continue;
    const id = (row as { id?: unknown }).id;
    if (typeof id === 'string') ids.add(id);
  }
  return ids;
}

/** 过滤 contents 行：剔除内置书内容（保留导入书内容）。 */
export function filterContentsForBackup(rows: unknown[], builtinIds: Set<string>): unknown[] {
  return rows.filter((row) => {
    const id = (row as { id?: unknown } | null)?.id;
    return !(typeof id === 'string' && builtinIds.has(id));
  });
}

/** 过滤 books 行：恢复时跳过内置书（其内容不在备份中，恢复出来也是点不开的书，
 * 换设备后按需重新领取即可）。 */
export function filterBooksForRestore(rows: unknown[]): unknown[] {
  return rows.filter((row) => !isBuiltinBookRow(row));
}

/** 备份包：全量本地数据快照，供换设备 / 清缓存恢复。 */
export interface BackupBundle {
  /** 来源标识，防止误导入别的应用的 JSON */
  app: 'tailtale';
  /** 备份格式版本 */
  version: number;
  /** 导出时间 ISO 字符串 */
  exportedAt: string;
  /** 各 IndexedDB store 的全量行（key 为 store 名） */
  stores: Record<string, unknown[]>;
  /** localStorage 中 tailtale:* 前缀键的键值对 */
  localStorage: Record<string, string>;
}

/** AI 配置（含密钥）在 localStorage 中的键（由 ai 模块持久化，备份侧在此登记）。 */
export const AI_CONFIG_KEY = 'tailtale:ai';

/** 备份中是否包含有效的 AI 密钥（明文）——用于导出选项的风险说明。 */
export function backupContainsAiKey(bundle: BackupBundle): boolean {
  const raw = bundle.localStorage[AI_CONFIG_KEY];
  if (!raw) return false;
  try {
    const cfg = JSON.parse(raw) as { key?: unknown };
    return typeof cfg.key === 'string' && cfg.key.length > 0;
  } catch {
    return false;
  }
}

/** 剔除备份中的 AI 密钥（标准备份档）：换设备后重新粘贴一次密钥即可，避免密钥随文件泄露。
 *  返回新对象，不修改入参；无密钥键时原样返回。 */
export function stripAiKey(bundle: BackupBundle): BackupBundle {
  if (!(AI_CONFIG_KEY in bundle.localStorage)) return bundle;
  const localStorage = { ...bundle.localStorage };
  delete localStorage[AI_CONFIG_KEY];
  return { ...bundle, localStorage };
}

/** parse 结果：成功带 bundle，失败带中文错误原因。 */
export type ParseResult =
  | { ok: true; bundle: BackupBundle }
  | { ok: false; error: string };

/** 解析并校验备份文本（JSON.parse + 形状校验），不触碰任何存储。 */
export function parseBackupBundle(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: '文件不是合法的 JSON' };
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: '备份内容格式不正确' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.app !== 'tailtale') {
    return { ok: false, error: '这不是书时的备份文件' };
  }
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    return { ok: false, error: `不支持的备份版本（当前仅支持 v${BACKUP_VERSION} 及以下）` };
  }
  if (typeof obj.stores !== 'object' || obj.stores === null || Array.isArray(obj.stores)) {
    return { ok: false, error: '备份数据损坏：stores 字段缺失' };
  }
  if (
    typeof obj.localStorage !== 'object' ||
    obj.localStorage === null ||
    Array.isArray(obj.localStorage)
  ) {
    return { ok: false, error: '备份数据损坏：localStorage 字段缺失' };
  }
  return {
    ok: true,
    bundle: {
      app: 'tailtale',
      version: obj.version,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
      stores: obj.stores as Record<string, unknown[]>,
      localStorage: obj.localStorage as Record<string, string>,
    },
  };
}
