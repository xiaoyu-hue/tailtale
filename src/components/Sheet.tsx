import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * 底部抽屉（通用原语）：从底部滑入的面板，替代此前阅读器专属的 reader-drawer。
 * ① 点遮罩关闭；② Esc 关闭；③ 始终挂载，靠 .open 类切换 → 进出场都有滑动过渡；
 * ④ aria-hidden 在未打开时隐藏，避免屏幕阅读器误读离屏内容；
 * ⑤ 令牌化配色 + 减少动画时关闭过渡。读设置浮层 / 筛选面板等均可复用。
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <>
      <div className={`sheet-mask${open ? ' open' : ''}`} onClick={onClose} aria-hidden={!open} />
      <aside
        className={`sheet${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
      >
        <div className="sheet-handle" aria-hidden="true" />
        {title && <div className="sheet-title">{title}</div>}
        <div className="sheet-body">{children}</div>
      </aside>
    </>,
    document.body
  );
}
