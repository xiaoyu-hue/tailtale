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

export interface Settings {
  /** 字号档位索引（0..FONT_SIZES.length-1），存索引不存 px，档位调整时老设置不失效 */
  fontSizeIndex: number;
  /** 主题选择；auto = 跟随系统深浅色（默认，保持 M1 行为） */
  theme: ThemeChoice;
}

export function defaultSettings(): Settings {
  return { fontSizeIndex: DEFAULT_FONT_SIZE_INDEX, theme: 'auto' };
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
