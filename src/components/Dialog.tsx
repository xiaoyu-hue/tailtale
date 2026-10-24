import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * 居中弹窗（通用原语）：遮罩 + 居中卡片。
 * ① 点遮罩关闭；② Esc 关闭；③ role=dialog + aria-modal 无障碍；
 * ④ 令牌化配色，跟随三主题；⑤ 减少动画时关闭过渡。
 * 轻量实现，不引入第三方依赖；需要更复杂场景（嵌套、焦点陷阱）再扩展。
 */
export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="dialog-mask" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <div className="dialog-title">{title}</div>}
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
