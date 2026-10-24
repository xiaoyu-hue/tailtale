import { useHostMode, setHostMode } from '../store';
import { toast } from '../../../components';

/** 主持人模式切换（本地 / AI；未配置密钥时禁用并引导去「我的」页）。 */
export function HostModeSwitch() {
  const hostMode = useHostMode();
  return (
    <label className="guess-host-switch">
      <span className="muted">AI 主持人</span>
      <input
        type="checkbox"
        checked={hostMode === 'ai'}
        onChange={(e) => {
          setHostMode(e.target.checked ? 'ai' : 'local');
          if (e.target.checked) {
            toast.info('AI 主持人每次互动约 0.003 元，失败会自动降级本地台词');
          }
        }}
      />
    </label>
  );
}
