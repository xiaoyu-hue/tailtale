import {
  DEFAULT_FONT_SIZE_INDEX,
  FONT_SIZES,
  clampFontSizeIndex,
  defaultSettings,
  isThemeChoice,
  type Settings,
} from './model';

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
