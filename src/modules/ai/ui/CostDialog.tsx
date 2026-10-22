import { useEffect, useRef } from 'react';
import { REFERENCE_PRICE, type CostEstimate } from '../model';

interface CostDialogProps {
  estimate: CostEstimate;
  /** 截断 / EPUB 部分失败等降级提示 */
  warning?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 费用预估弹窗（PRD §5.3 成本控制）：调用前展示预估 token 与费用，
 * 用户确认后才真正发起 API 调用；不设服务端限额（BYOK，费用走用户自己的账户）。
 * 交互增强：打开自动聚焦（焦点圈可见）、Esc 关闭、点击遮罩关闭。
 */
export function CostDialog({ estimate, warning, onConfirm, onCancel }: CostDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="ai-dialog-mask"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="ai-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="费用预估"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h3 className="ai-dialog-title">预估本次解读费用</h3>
        <dl className="ai-cost-list">
          <div>
            <dt>预计调用</dt>
            <dd>{estimate.calls} 次</dd>
          </div>
          <div>
            <dt>预计输入</dt>
            <dd>约 {estimate.inputTokens.toLocaleString()} tokens</dd>
          </div>
          <div>
            <dt>预计输出</dt>
            <dd>约 {estimate.outputTokens.toLocaleString()} tokens</dd>
          </div>
          <div>
            <dt>预估费用</dt>
            <dd className="ai-cost-fee">约 ¥{estimate.feeYuan.toFixed(2)}</dd>
          </div>
        </dl>
        {warning && <p className="ai-dialog-warning">{warning}</p>}
        <p className="muted">
          按参考价（输入 ¥{REFERENCE_PRICE.inputPerMillion}／输出 ¥{REFERENCE_PRICE.outputPerMillion}{' '}
          每百万 tokens）估算，{REFERENCE_PRICE.note}。
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            确认生成
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
