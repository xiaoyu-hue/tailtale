// settings 模块公开 API：全局偏好（正文字号、主题、界面皮肤、数据备份）
export { useSettings, useFontSizeIndex, useTheme, useSkin, setFontSizeIndex, setTheme, setSkin } from './store';
export {
  FONT_SIZES,
  THEME_CHOICES,
  THEME_SKINS,
  DEFAULT_FONT_SIZE_INDEX,
  MAX_FONT_SIZE_INDEX,
  fontSizeAt,
} from './model';
export type { Settings, ThemeChoice, UiSkin } from './model';
export { SettingsPanel } from './ui/SettingsPanel';
export { BackupSection } from './ui/BackupSection';
export {
  collectBackup,
  restoreBackup,
  exportBackupToFile,
  importBackupFromFile,
} from './service';
export { parseBackupBundle, BACKUP_VERSION } from './model';
export type { BackupBundle } from './model';
