import { useEffect, useRef, useState } from 'react';
import type { BackupEnvelope } from '../model';

interface ImportPasswordDialogProps {
  envelope: BackupEnvelope;
  /** 解密 + 写回进行中（PBKDF2 派生 + AES 解密，低端机约 1 秒） */
  busy: boolean;
  /** 上一次口令错误 / 文件损坏的原因，展示在输入框上方 */
  error: string | null;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}

/**
 * 加密备份口令弹窗（v1.11.0）：readBackupFile 识别出加密信封后弹出，
 * 收口令 → 解密 → 恢复。口令错误 / 文件被篡改时保留对话框并展示原因，可重试。
 * 交互与费用弹窗一致：打开自动聚焦、Esc 关闭、点击遮罩关闭。
 */
export function ImportPasswordDialog({
  envelope,
  busy,
  error,
  onCancel,
  onConfirm,
}: ImportPasswordDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const exportedAt = envelope.exportedAt ? envelope.exportedAt.slice(0, 10) : '未知日期';

  return (
    <div
      className="backup-dialog-mask"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="backup-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label="输入备份口令"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h3 className="backup-dialog-title">此备份已加密</h3>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
          备份创建于 {exportedAt}。请输入导出时设置的口令以解密并恢复。
        </p>
        {error && <p className="ai-dialog-warning">{error}</p>}
        <div className="ai-field">
          <label className="settings-label" htmlFor="backup-import-password">
            备份口令
          </label>
          <input
            id="backup-import-password"
            className="ai-input"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || password.length === 0}
            onClick={() => onConfirm(password)}
          >
            {busy ? '解密中…' : '解密并导入'}
          </button>
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
