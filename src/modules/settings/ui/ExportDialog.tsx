import { useEffect, useRef, useState } from 'react';
import { backupContainsAiKey, type BackupBundle } from '../model';

/** 导出档位：standard = 标准备份（默认，剔除 AI 密钥）；
 *  encrypted = 加密备份（整文件加密，v1.11.0）；plain = 完整明文备份（含密钥）。 */
export type ExportMode = 'standard' | 'encrypted' | 'plain';

/** 口令最短板长：低于此值视为弱口令，拒绝加密导出（防离线暴力破解）。 */
const MIN_PASSWORD_LENGTH = 8;

interface ExportDialogProps {
  /** 已收集的全量备份快照（打开对话框时采集，导出时按档位处理） */
  bundle: BackupBundle;
  onCancel: () => void;
  /** mode 为 encrypted 时携带口令；由调用方负责异步导出与 busy 态 */
  onExport: (mode: ExportMode, password?: string) => void;
  /** 加密导出进行中（PBKDF2 派生 + AES 加密，低端机约 1 秒） */
  exporting?: boolean;
}

/**
 * 导出选项弹窗（v1.10.0 三档分级；v1.11.0 增加加密档）：
 *  ① 标准备份（默认）：剔除 AI 密钥，从源头避免密钥随备份泄露；
 *  ② 加密备份：整个文件加密，需设置口令（只用于本次派生，不落存储）；
 *  ③ 完整明文备份：含密钥与书籍全文，仅供本机保管。
 * 交互与费用弹窗一致：打开自动聚焦、Esc 关闭、点击遮罩关闭。
 */
export function ExportDialog({ bundle, onCancel, onExport, exporting = false }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ExportMode>('standard');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // WebCrypto 需安全上下文（HTTPS / localhost）；http 环境下加密档不可用
  const cryptoReady = typeof globalThis.crypto?.subtle?.importKey === 'function';

  const hasKey = backupContainsAiKey(bundle);
  const encrypted = mode === 'encrypted';
  const passwordTooShort = encrypted && password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const passwordMismatch = encrypted && confirmPassword.length > 0 && password !== confirmPassword;
  const canExport =
    !exporting &&
    (!encrypted || (password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword));

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
        aria-label="导出备份选项"
        tabIndex={-1}
        ref={dialogRef}
      >
        <h3 className="backup-dialog-title">导出备份</h3>
        <div className="backup-options" role="radiogroup" aria-label="备份档位">
          <label className={`backup-option${mode === 'standard' ? ' active' : ''}`}>
            <input
              type="radio"
              name="backup-mode"
              value="standard"
              checked={mode === 'standard'}
              onChange={() => setMode('standard')}
            />
            <span className="backup-option-body">
              <span className="backup-option-title">标准备份（推荐）</span>
              <span className="backup-option-desc">
                不含 AI 密钥、未加密。换新设备后需要重新粘贴一次密钥。
              </span>
            </span>
          </label>
          <label className={`backup-option${mode === 'encrypted' ? ' active' : ''}${cryptoReady ? '' : ' disabled'}`}>
            <input
              type="radio"
              name="backup-mode"
              value="encrypted"
              checked={mode === 'encrypted'}
              onChange={() => setMode('encrypted')}
              disabled={!cryptoReady}
            />
            <span className="backup-option-body">
              <span className="backup-option-title">加密备份</span>
              <span className="backup-option-desc">
                整个文件加密（含 AI 密钥与书籍内容），需设置口令。
                忘记口令将无法恢复备份，请妥善保管。适合保存到网盘或传输给他人。
                {!cryptoReady && '（当前环境不支持加密，需要 HTTPS 访问）'}
              </span>
            </span>
          </label>
          <label className={`backup-option${mode === 'plain' ? ' active' : ''}`}>
            <input
              type="radio"
              name="backup-mode"
              value="plain"
              checked={mode === 'plain'}
              onChange={() => setMode('plain')}
            />
            <span className="backup-option-body">
              <span className="backup-option-title">完整备份（含密钥，不加密）</span>
              <span className="backup-option-desc">
                含明文的 AI 密钥与书籍内容（{hasKey ? '当前已配置密钥' : '当前未配置密钥'}
                ）。仅建议在本机保管，切勿网络传输或存放到公共位置。
              </span>
            </span>
          </label>
        </div>

        {encrypted && (
          <div className="backup-password-fields">
            <div className="ai-field">
              <label className="settings-label" htmlFor="backup-password">
                备份口令
              </label>
              <input
                id="backup-password"
                className="ai-input"
                type="password"
                autoComplete="new-password"
                placeholder={`至少 ${MIN_PASSWORD_LENGTH} 位`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="ai-field">
              <label className="settings-label" htmlFor="backup-password-confirm">
                确认口令
              </label>
              <input
                id="backup-password-confirm"
                className="ai-input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <p className="ai-dialog-warning">
              忘记口令 = 备份永久无法恢复，没有任何后门。
            </p>
            {passwordTooShort && (
              <p className="ai-dialog-warning">口令太短，至少 {MIN_PASSWORD_LENGTH} 位。</p>
            )}
            {passwordMismatch && <p className="ai-dialog-warning">两次输入的口令不一致。</p>}
          </div>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canExport}
            onClick={() => onExport(mode, encrypted ? password : undefined)}
          >
            {exporting ? '加密中…' : '导出备份'}
          </button>
          <button type="button" className="btn" onClick={onCancel} disabled={exporting}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
