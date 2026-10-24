import { useState, type JSX } from 'react';
import { Sheet, toast } from '../../../components';
import { GAME_LABELS, type GameId } from '../model';
import { GuessNumberGame } from './GuessNumberGame';

/**
 * 游戏目录（批次 1 仅猜数字可玩；后续批次逐个接入——
 * 本数组加一行 + ui/ 加一个对局组件 + GAME_ECONOMY 加一条目即可）。
 */
const GAMES: Array<{ id: GameId; planned?: boolean }> = [
  { id: 'guess_number' },
  { id: 'guess_idiom', planned: true },
  { id: 'guess_riddle', planned: true },
  { id: 'brain_teaser', planned: true },
  { id: 'gomoku', planned: true },
  { id: 'tictactoe', planned: true },
];

function DiceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GamepadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="7" width="19" height="10.5" rx="4" />
      <path d="M7 10.5v3M5.5 12h3M15.5 11.5h.01M18 13.5h.01" />
    </svg>
  );
}

const ICONS: Record<GameId, JSX.Element> = {
  guess_number: <DiceIcon />,
  guess_idiom: <GamepadIcon />,
  guess_riddle: <GamepadIcon />,
  brain_teaser: <GamepadIcon />,
  gomoku: <GamepadIcon />,
  tictactoe: <GamepadIcon />,
};

/** 游戏主页：宫格入口 + 底部抽屉展开对局（复刻工具箱容器模式）。 */
export function GamesView({ onBack }: { onBack: () => void }) {
  const [active, setActive] = useState<GameId | null>(null);
  const [open, setOpen] = useState(false);

  const openGame = (id: GameId, planned?: boolean) => {
    if (planned) {
      toast.info('规划中（后续批次上线），敬请期待');
      return;
    }
    setActive(id);
    setOpen(true);
  };

  // 关闭：先收起抽屉，等滑出动画结束再清空内容，避免内容瞬间空白
  const closeGame = () => {
    setOpen(false);
    window.setTimeout(() => setActive(null), 220);
  };

  return (
    <>
      <div className="toolbox-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="返回首页">
          ‹
        </button>
        <h1 className="page-title">游戏</h1>
      </div>

      <p className="muted toolbox-sub">轻松小游戏，赚金币养宠物；AI 主持人可选，无 AI 也能玩。</p>

      <div className="feature-grid games-grid">
        {GAMES.map(({ id, planned }) => (
          <button
            key={id}
            type="button"
            className={`feature-cell${planned ? ' planned' : ''}`}
            onClick={() => openGame(id, planned)}
          >
            <span className="feature-icon">{ICONS[id]}</span>
            <span className="feature-label">{GAME_LABELS[id]}</span>
            {planned && <span className="feature-badge">后续批次</span>}
          </button>
        ))}
      </div>

      <Sheet open={open} onClose={closeGame} title={active ? GAME_LABELS[active] : undefined}>
        {active === 'guess_number' && <GuessNumberGame />}
      </Sheet>
    </>
  );
}
