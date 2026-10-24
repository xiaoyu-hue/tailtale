import { useState, type JSX } from 'react';
import { Sheet, toast } from '../../../components';
import { GAME_LABELS, type GameId } from '../model';
import { GuessNumberGame } from './GuessNumberGame';
import { QuizGame } from './QuizGame';
import { GomokuGame } from './GomokuGame';
import { TictactoeGame } from './TictactoeGame';
import { MatchHistory } from './MatchHistory';

/**
 * 游戏目录（批次 2 起六个游戏全部可玩；「战绩」为对局流水入口）。
 * 后续新增游戏：GAMES 加一行 + ui/ 加一个对局组件 + GAME_ECONOMY 加一条目。
 */
type CellId = GameId | 'matches';

const GAMES: Array<{ id: CellId; planned?: boolean }> = [
  { id: 'guess_number' },
  { id: 'guess_idiom' },
  { id: 'guess_riddle' },
  { id: 'brain_teaser' },
  { id: 'gomoku' },
  { id: 'tictactoe' },
  { id: 'matches' },
];

/** 四选一猜词游戏（共用 QuizGame 组件）。 */
const QUIZ_IDS = new Set<GameId>(['guess_idiom', 'guess_riddle', 'brain_teaser']);

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

function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 11H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4" />
      <path d="M20 11h-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.2a2.8 2.8 0 0 1 5.4.9c0 1.9-2.6 2.4-2.6 4.1" />
      <path d="M12 17.6h.01" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="12" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="12" cy="18" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
      <circle cx="12" cy="12" r="9.5" strokeDasharray="3 2.5" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7.6 4.2" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

const ICONS: Record<CellId, JSX.Element> = {
  guess_number: <DiceIcon />,
  guess_idiom: <BookIcon />,
  guess_riddle: <QuoteIcon />,
  brain_teaser: <QuestionIcon />,
  gomoku: <GridIcon />,
  tictactoe: <CrossIcon />,
  matches: <HistoryIcon />,
};

const LABELS: Record<CellId, string> = {
  ...GAME_LABELS,
  matches: '战绩',
};

/** 游戏主页：宫格入口 + 底部抽屉展开对局（复刻工具箱容器模式）。 */
export function GamesView({ onBack }: { onBack: () => void }) {
  const [active, setActive] = useState<CellId | null>(null);
  const [open, setOpen] = useState(false);

  const openGame = (id: CellId, planned?: boolean) => {
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
            <span className="feature-label">{LABELS[id]}</span>
            {planned && <span className="feature-badge">后续批次</span>}
          </button>
        ))}
      </div>

      <Sheet open={open} onClose={closeGame} title={active ? LABELS[active] : undefined}>
        {active === 'guess_number' && <GuessNumberGame />}
        {active !== null && QUIZ_IDS.has(active as GameId) && (
          <QuizGame gameId={active as 'guess_idiom' | 'guess_riddle' | 'brain_teaser'} />
        )}
        {active === 'gomoku' && <GomokuGame />}
        {active === 'tictactoe' && <TictactoeGame />}
        {active === 'matches' && <MatchHistory />}
      </Sheet>
    </>
  );
}
