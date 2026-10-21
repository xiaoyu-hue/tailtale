import type { Pet } from '../model';

const STATS = [
  { key: 'hunger', label: '饱食度' },
  { key: 'mood', label: '心情' },
  { key: 'energy', label: '精力' },
] as const;

/** 三属性条形图：数值直接来自 pet（无本地状态，属性变化随 store 自动重渲染）。
 *  衰减结算按天的小数累加（模型保持精度），展示层取整。 */
export function StatBars({ pet }: { pet: Pet }) {
  return (
    <div className="stat-bars">
      {STATS.map(({ key, label }) => {
        const value = Math.round(pet[key]);
        return (
          <div className="stat-bar-row" key={key}>
            <span className="stat-bar-label">{label}</span>
            <div className="stat-bar-track">
              <div
                className={`stat-bar-fill stat-bar-fill--${key}${value < 30 ? ' is-low' : ''}`}
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="stat-bar-value">{value}</span>
          </div>
        );
      })}
    </div>
  );
}
