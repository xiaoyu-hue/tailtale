import { useEffect, useRef, useState } from 'react';
import { backupContainsAiKey, type BackupBundle } from '../model';

/** 导出档位：standard = 标准备份（默认，剔除 AI 密钥）；plain = 完整明文备份（含密钥）。 */
export type ExportMode = 'standard' | 'plain';

interface ExportDialogProps {
  /** 已收集的全量备份快照（打开对话框时采集，导出时按档位处理） */
  bundle: BackupBundle;
  onCancel: () => void;
  onExport: (mode: ExportMode) => void;
}

/**
 * 导出选项弹窗（v1.10.0 备份安全分级）：导出前让用户显式选择档位，
 * 默认「标准备份」不含 AI 密钥，从源头避免密钥随备份文件泄露；
 * 「完整明文备份」保留原能力但标注风险，仅供本机保管。
 * 交互与费用弹窗一致：打开自动聚焦、Esc 关闭、点击遮罩关闭。
 */
export function ExportDialog({ bundle, onCancel, onExport }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ExportMode>('standard');

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const hasKey = backupContainsAiKey(bundle);

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
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => onExport(mode)}>
            导出备份
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
