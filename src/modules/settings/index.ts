// settings 模块公开 API：全局偏好（正文字号、主题）
export { useSettings, useFontSizeIndex, useTheme, setFontSizeIndex, setTheme } from './store';
export { FONT_SIZES, THEME_CHOICES, DEFAULT_FONT_SIZE_INDEX, MAX_FONT_SIZE_INDEX, fontSizeAt } from './model';
export type { Settings, ThemeChoice } from './model';
export { SettingsPanel } from './ui/SettingsPanel';
