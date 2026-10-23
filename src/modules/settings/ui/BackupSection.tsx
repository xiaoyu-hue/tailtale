import { useRef, useState } from 'react';
import { collectBackup, exportBackupToFile, importBackupFromFile } from '../service';
import { stripAiKey, type BackupBundle } from '../model';
import { ExportDialog, type ExportMode } from './ExportDialog';

/**
 * 数据备份卡片（M6）：一键导出 / 导入全部本地数据。
 * 导出：先收集全量快照，再经导出选项弹窗选择档位（v1.10.0）——
 *   标准备份（默认）剔除 AI 密钥；完整明文备份含密钥，仅供本机保管。
 * 导入：选文件 → 确认覆盖 → 写回 → 整页刷新重水合（导入即覆盖，最稳）。
 */
export function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exportBundle, setExportBundle] = useState<BackupBundle | null>(null);
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

  const handleExportConfirm = (mode: ExportMode) => {
    const bundle = exportBundle;
    setExportBundle(null);
    if (!bundle) return;
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
    try {
      const result = await importBackupFromFile(file);
      if (!result.ok) {
        showToast(`导入失败：${result.error}`);
        setBusy(false);
        return;
      }
      showToast('导入成功，正在刷新…');
      // 整页刷新，让各模块从存储重新水合（最简单且零残留态）
      window.location.reload();
    } catch (error) {
      console.error('导入备份失败', error);
      showToast('导入失败，请确认文件格式');
      setBusy(false);
    }
  };

  return (
    <section className="card backup-section" id="backup">
      <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>数据备份</h2>
      <p className="muted" style={{ margin: '0 0 12px' }}>
        把所有本地数据（书籍、金币、宠物、打卡等）导出为一个文件，换设备或清理缓存后可导入恢复。
        导出时可选择档位：默认的<strong>标准备份不含 AI 密钥</strong>（换设备后重新粘贴一次即可）；
        含密钥的完整备份是明文文件，请妥善保管，切勿分享或上传到公开位置。
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
          onCancel={() => setExportBundle(null)}
          onExport={handleExportConfirm}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </section>
  );
}
