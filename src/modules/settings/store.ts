import { createStore, useStore } from '../../platform/store';
import { loadSettings, saveSettings } from './service';
import { clampFontSizeIndex, type Settings, type ThemeChoice } from './model';

const store = createStore<Settings>(loadSettings());

/** 主题落到 <html data-theme>，CSS 变量镜像响应（auto = 移除属性，回到系统媒体查询）。 */
function applyTheme(theme: ThemeChoice): void {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

// 模块加载即应用：避免刷新后主题闪错（脚本在 <html> 之后执行，无 FOUC 窗口）
applyTheme(store.getState().theme);

// ---- 订阅 hooks（selector 返回基本类型或 state 引用） ----

export function useSettings(): Settings {
  return useStore(store, (s) => s);
}

export function useFontSizeIndex(): number {
  return useStore(store, (s) => s.fontSizeIndex);
}

export function useTheme(): ThemeChoice {
  return useStore(store, (s) => s.theme);
}

// ---- 状态动作 ----

function patch(next: Partial<Settings>): void {
  const updated = { ...store.getState(), ...next };
  store.setState(updated);
  saveSettings(updated);
  if (next.theme !== undefined) applyTheme(next.theme);
}

export function setFontSizeIndex(index: number): void {
  patch({ fontSizeIndex: clampFontSizeIndex(index) });
}

export function setTheme(theme: ThemeChoice): void {
  patch({ theme });
}
