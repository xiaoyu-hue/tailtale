import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

// —— 轻量外部 store：不依赖 React 上下文，非组件模块也能调用 toast.success(...) ——
const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];
let counter = 0;

function emit(): void {
  for (const l of listeners) l(items);
}

const DURATION_MS = 2800;

/**
 * 弹出一条 toast。type 决定配色/图标；默认 2.8s 后自动消失。
 * 组件内外都能调用（需在 <ToastViewport /> 已挂载的树内才会显示）。
 */
export function showToast(message: string, type: ToastType = 'info'): void {
  const id = ++counter;
  items = [...items, { id, message, type }];
  emit();
  window.setTimeout(() => {
    items = items.filter((i) => i.id !== id);
    emit();
  }, DURATION_MS);
}

export const toast = {
  info: (message: string) => showToast(message, 'info'),
  success: (message: string) => showToast(message, 'success'),
  error: (message: string) => showToast(message, 'error'),
};

/** 订阅当前 toast 列表（供视口组件使用）。 */
export function useToasts(): ToastItem[] {
  const [state, setState] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

const ICONS: Record<ToastType, string> = {
  info: 'ℹ',
  success: '✓',
  error: '!',
};

/** Toast 视口：全站挂载一次（App 根部），渲染所有 toast。 */
export function ToastViewport(): ReactNode {
  const toasts = useToasts();
  return createPortal(
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`} role="status">
          <span className="toast-icon" aria-hidden="true">
            {ICONS[t.type]}
          </span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}
