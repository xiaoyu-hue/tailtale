import { useRef, useState } from 'react';
import { collectBackup, exportBackupToFile, importBackupFromFile } from '../service';
import type { BackupBundle } from '../model';

/** 备份中是否包含有效的 AI 密钥（明文）——用于导出前风险警示。 */
function backupContainsAiKey(bundle: BackupBundle): boolean {
  const raw = bundle.localStorage['tailtale:ai'];
  if (!raw) return false;
  try {
    const cfg = JSON.parse(raw) as { key?: unknown };
    return typeof cfg.key === 'string' && cfg.key.length > 0;
  } catch {
    return false;
  }
}

/**
 * 数据备份卡片（M6）：一键导出 / 导入全部本地数据。
 * 导出：把 IndexedDB 六个 store + localStorage 的 tailtale:* 键打包成 JSON 下载。
 * 导入：选文件 → 确认覆盖 → 写回 → 整页刷新重水合（导入即覆盖，最稳）。
 */
export function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const handleExport = async () => {
    try {
      const bundle = await collectBackup();
      // 备份含明文 AI 密钥时，导出前明确警示，避免用户误分享导致密钥泄露、额度被盗刷
      if (backupContainsAiKey(bundle)) {
        if (
          !window.confirm(
            '提醒：备份文件包含您的 AI 密钥（明文）。请妥善保管，不要分享给他人或上传到公开位置。仍要导出？'
          )
        ) {
          return;
        }
      }
      exportBackupToFile(bundle);
      showToast('已导出备份文件');
    } catch (error) {
      console.error('导出备份失败', error);
      showToast('导出失败，请重试');
    }
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
        把所有本地数据（书籍、金币、宠物、打卡、AI 密钥等）导出为一个文件，换设备或清理缓存后可导入恢复。
        备份文件以<strong>明文</strong>保存您的 AI 密钥，请妥善保管，切勿分享或上传到公开位置。
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
      {toast && <div className="toast">{toast}</div>}
    </section>
  );
}
