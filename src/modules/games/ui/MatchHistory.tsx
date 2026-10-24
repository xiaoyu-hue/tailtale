import { useEffect } from 'react';
import { useMatchHistory, refreshMatches } from '../store';
import { GAME_LABELS } from '../model';

/** 结果徽标文案与样式类。 */
const RESULT_META: Record<'won' | 'lost' | 'draw', { label: string; cls: string }> = {
  won: { label: '胜', cls: 'match-result--won' },
  lost: { label: '负', cls: 'match-result--lost' },
  draw: { label: '平', cls: 'match-result--draw' },
};

/** 对局时间：今天 HH:MM / 昨天 / MM-DD。 */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `今天 ${hh}:${mm}`;
  if (yesterday) return `昨天 ${hh}:${mm}`;
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hh}:${mm}`;
}

/** 对局流水列表（Sheet 内容）：最近 50 条，按时间倒序。 */
export function MatchHistory() {
  const matches = useMatchHistory();

  // 打开 Sheet 即刷新（结算动作不保证本页已刷新）
  useEffect(() => {
    void refreshMatches();
  }, []);

  if (matches.length === 0) {
    return <p className="muted">还没有对局记录，去玩一局吧。</p>;
  }

  return (
    <div className="matches-list">
      {matches.map((m) => {
        const meta = RESULT_META[m.result];
        return (
          <div key={m.id} className="match-row">
            <span className={`match-result ${meta.cls}`}>{meta.label}</span>
            <span className="match-game">{GAME_LABELS[m.gameId]}</span>
            <span className="muted match-coins">{m.coins > 0 ? `+${m.coins} 金币` : '—'}</span>
            <span className="muted match-time">{formatTime(m.playedAt)}</span>
          </div>
        );
      })}
    </div>
  );
}
