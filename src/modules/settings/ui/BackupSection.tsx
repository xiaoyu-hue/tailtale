import { useRef, useState } from 'react';
import {
  collectBackup,
  exportBackupToFile,
  exportEncryptedBackupToFile,
  importEncryptedBackup,
  readBackupFile,
  restoreBackup,
} from '../service';
import { stripAiKey, type BackupBundle, type BackupEnvelope } from '../model';
import { ExportDialog, type ExportMode } from './ExportDialog';
import { ImportPasswordDialog } from './ImportPasswordDialog';

/**
 * 数据备份卡片（M6）：一键导出 / 导入全部本地数据。
 * 导出（v1.10.0 三档分级，v1.11.0 加密档）：先收集全量快照，再经导出选项弹窗选择档位——
 *   标准备份（默认）剔除 AI 密钥；加密备份整文件加密（口令只用于本次派生，不落存储）；
 *   完整明文备份含密钥，仅供本机保管。
 * 导入：选文件 → 确认覆盖 → 读取分类：明文包直接恢复；加密包弹口令框解密后恢复 →
 *   整页刷新重水合（导入即覆盖，最稳）。
 */
export function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exportBundle, setExportBundle] = useState<BackupBundle | null>(null);
  const [pendingEnvelope, setPendingEnvelope] = useState<BackupEnvelope | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const toastTimer = useRef(0);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const handleExport = async () => {
    try {
      // 先采集快照再弹选项：档位说明按实际数据展示（如是否已配置密钥）
      setExportBundle(await collectBackup());
    } catch (error) {
      console.error('导出备份失败', error);
      showToast('导出失败，请重试');
    }
  };

  const handleExportConfirm = async (mode: ExportMode, password?: string) => {
    const bundle = exportBundle;
    setExportBundle(null);
    if (!bundle) return;
    if (mode === 'encrypted') {
      if (!password) return;
      setExporting(true);
      try {
        await exportEncryptedBackupToFile(password);
        showToast('已导出加密备份，请牢记口令');
      } catch (error) {
        console.error('加密导出失败', error);
        showToast('加密导出失败，请重试');
      } finally {
        setExporting(false);
      }
      return;
    }
    const out = mode === 'standard' ? stripAiKey(bundle) : bundle;
    exportBackupToFile(out);
    showToast(
      mode === 'standard' ? '已导出备份（不含 AI 密钥）' : '已导出备份（含明文 AI 密钥，请妥善保管）'
    );
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 清空 value，保证同一文件可重复选择触发 change
    event.target.value = '';
    if (!file) return;
    if (!window.confirm('导入将覆盖本机当前的全部数据（书籍、金币、宠物、打卡、AI 密钥等）。确定继续？')) {
      return;
    }
    setBusy(true);
    setImportError(null);
    try {
      const read = await readBackupFile(file);
      if (!read.ok) {
        showToast(`导入失败：${read.error}`);
        setBusy(false);
        return;
      }
      if (read.kind === 'encrypted') {
        // 加密备份：弹口令框（busy 态移交口令对话框），解密成功后才写回
        setPendingEnvelope(read.envelope);
        setBusy(false);
        return;
      }
      await restoreBackup(read.bundle);
      showToast('导入成功，正在刷新…');
      // 整页刷新，让各模块从存储重新水合（最简单且零残留态）
      window.location.reload();
    } catch (error) {
      console.error('导入备份失败', error);
      showToast('导入失败，请确认文件格式');
      setBusy(false);
    }
  };

  const handleImportConfirm = async (password: string) => {
    const envelope = pendingEnvelope;
    if (!envelope) return;
    setBusy(true);
    try {
      const result = await importEncryptedBackup(envelope, password);
      if (!result.ok) {
        // 口令错误 / 文件损坏：保留对话框展示原因，允许重试
        setImportError(result.error);
        setBusy(false);
        return;
      }
      setPendingEnvelope(null);
      showToast('导入成功，正在刷新…');
      window.location.reload();
    } catch (error) {
      console.error('加密备份导入失败', error);
      setImportError('解密失败，请确认文件格式');
      setBusy(false);
    }
  };

  return (
    <section className="card backup-section" id="backup">
      <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>数据备份</h2>
      <p className="muted" style={{ margin: '0 0 12px' }}>
        把所有本地数据（书籍、金币、宠物、打卡等）导出为一个文件，换设备或清理缓存后可导入恢复。
        导出三档可选：<strong>标准备份</strong>（默认，不含 AI 密钥）、<strong>加密备份</strong>
        （整个文件加密，需设置口令，忘记口令无法恢复）、<strong>完整明文备份</strong>
        （含密钥，仅供本机保管）。
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={handleExport}>
          导出备份
        </button>
        <button
          type="button"
          className="btn"
          onClick={handleImportClick}
          disabled={busy}
        >
          {busy ? '导入中…' : '导入备份'}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      {exportBundle && (
        <ExportDialog
          bundle={exportBundle}
          exporting={exporting}
          onCancel={() => {
            if (!exporting) setExportBundle(null);
          }}
          onExport={handleExportConfirm}
        />
      )}
      {pendingEnvelope && (
        <ImportPasswordDialog
          envelope={pendingEnvelope}
          busy={busy}
          error={importError}
          onCancel={() => {
            setPendingEnvelope(null);
            setImportError(null);
          }}
          onConfirm={handleImportConfirm}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </section>
  );
}
