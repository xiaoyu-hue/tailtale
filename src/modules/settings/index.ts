// settings 模块公开 API：全局偏好（正文字号、主题、界面皮肤、减少动画、数据备份）
export {
  useSettings,
  useFontSizeIndex,
  useTheme,
  useSkin,
  useReduceMotion,
  setFontSizeIndex,
  setTheme,
  setSkin,
  setReduceMotion,
} from './store';
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
  exportEncryptedBackupToFile,
  readBackupFile,
  importEncryptedBackup,
} from './service';
export { parseBackupBundle, BACKUP_VERSION } from './model';
export type { BackupBundle, BackupEnvelope } from './model';
