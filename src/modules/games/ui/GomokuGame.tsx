import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../../../components';
import { useGameRecord, useHostMode, settleGameRound, recordDraw } from '../store';
import { fetchHostLine, type HostLine } from '../service';
import { GAME_ECONOMY, type HostContext, type HostEvent } from '../model';
import {
  BLACK,
  EMPTY,
  WHITE,
  checkWin,
  createBoard,
  getWinLine,
  isFull,
  isValidMove,
  placeStone,
  type Board,
  type Move,
} from '../../../vendor/gomoku/gomoku.js';
import { getAIMove, type Difficulty } from '../../../vendor/gomoku/ai.js';
import { HostBubble } from './HostBubble';
import { HostModeSwitch } from './HostModeSwitch';
import { GameOverPanel } from './GameOverPanel';

/** AI 应手延迟（毫秒）：让出主线程渲染「思考中」，也避免落子瞬间响应显得机械。 */
const AI_DELAY_MS = 350;

const DIFFICULTIES: Array<{ id: Difficulty; label: string }> = [
  { id: 'easy', label: '简单' },
  { id: 'medium', label: '中等' },
  { id: 'hard', label: '困难' },
];

type RoundResult = 'won' | 'lost' | 'draw';

/**
 * 五子棋对局（Sheet 内容）：15×15 标准棋盘，玩家执黑先手，AI 执白
 * （vendored sen-ltd/gomoku-ai：minimax + alpha-beta，三档难度）。
 * 胜局 +3 金币（日上限 9）；平局不奖不罚不写库（与「离开不判负」同口径）。
 */
export function GomokuGame() {
  const record = useGameRecord('gomoku');
  const hostMode = useHostMode();
  const [board, setBoard] = useState<Board>(createBoard);
  const [playerTurn, setPlayerTurn] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [winLine, setWinLine] = useState<Move[] | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [over, setOver] = useState<RoundResult | null>(null);
  /** 结束时的现场事实（结束面板与 AI 点评的事实来源） */
  const [overDetail, setOverDetail] = useState('');
  const [line, setLine] = useState<HostLine | null>(null);
  const [pending, setPending] = useState(false);
  const [settled, setSettled] = useState<{ gained: number; awarded: boolean } | null>(null);
  const startedRef = useRef(false);

  const speak = useCallback(
    async (event: HostEvent, ctx: HostContext) => {
      setPending(true);
      try {
        const result = await fetchHostLine(hostMode, event, ctx);
        setLine(result);
      } finally {
        setPending(false);
      }
    },
    [hostMode]
  );

  // 开局台词（StrictMode 双挂载守卫：只请求一次，避免 AI 模式重复付费）
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void speak('start', {
      gameId: 'gomoku',
      seed: record?.plays ?? 0,
      streak: record?.streak ?? 0,
      bestStreak: record?.bestStreak ?? 0,
      detail: '你执黑先手，先成五子者胜',
    });
    // eslint 守卫生效中：仅挂载执行一次，record 通过 speak 时读取最新值
  }, [speak, record]);

  /** 结算并播台词（金币先落库发放；平局不结算——不奖不罚不写库）。 */
  const finish = async (result: RoundResult, winCells: Move[] | null, detail: string) => {
    setOver(result);
    setOverDetail(detail);
    setWinLine(winCells);
    if (result === 'draw') {
      void recordDraw('gomoku');
      await speak('draw', {
        gameId: 'gomoku',
        seed: (record?.plays ?? 0) + 1,
        streak: record?.streak ?? 0,
        bestStreak: record?.bestStreak ?? 0,
        detail,
      });
      return;
    }
    const won = result === 'won';
    const settleResult = await settleGameRound('gomoku', won);
    setSettled({ gained: settleResult.settlement.gained, awarded: settleResult.awarded });
    if (settleResult.settlement.gained > 0) {
      if (settleResult.awarded) toast.success(`获得 ${settleResult.settlement.gained} 金币`);
      else toast.error('战绩已记录，金币发放失败');
    }
    await speak(won ? 'win' : 'lose', {
      gameId: 'gomoku',
      seed: (record?.plays ?? 0) + 1,
      streak: settleResult.settlement.record.streak,
      bestStreak: settleResult.settlement.record.bestStreak,
      detail,
    });
  };

  const playerMove = (r: number, c: number) => {
    if (over || aiThinking || !playerTurn || !isValidMove(board, r, c)) return;
    const next = placeStone(board, r, c, BLACK);
    setBoard(next);
    setPlayerTurn(false);
    if (checkWin(next, r, c, BLACK)) {
      void finish('won', getWinLine(next, r, c, BLACK), `你在第 ${countStones(next, BLACK)} 手成五`);
      return;
    }
    if (isFull(next)) {
      void finish('draw', null, '棋盘下满，无人成五');
      return;
    }
    setAiThinking(true);
    // AI 同步搜索前让出一帧，保证「思考中」状态先渲染
    window.setTimeout(() => {
      const [ar, ac] = getAIMove(next, WHITE, difficulty);
      const aiBoard = placeStone(next, ar, ac, WHITE);
      setAiThinking(false);
      setPlayerTurn(true);
      if (checkWin(aiBoard, ar, ac, WHITE)) {
        void finish('lost', getWinLine(aiBoard, ar, ac, WHITE), 'AI 先成五，输了');
        setBoard(aiBoard);
        return;
      }
      if (isFull(aiBoard)) {
        void finish('draw', null, '棋盘下满，无人成五');
        setBoard(aiBoard);
        return;
      }
      setBoard(aiBoard);
    }, AI_DELAY_MS);
  };

  const restart = () => {
    setBoard(createBoard());
    setPlayerTurn(true);
    setWinLine(null);
    setOver(null);
    setOverDetail('');
    setSettled(null);
    setLine(null);
    void speak('start', {
      gameId: 'gomoku',
      seed: (record?.plays ?? 0) + 1,
      streak: record?.streak ?? 0,
      bestStreak: record?.bestStreak ?? 0,
      detail: '你执黑先手，先成五子者胜',
    });
  };

  const cap = GAME_ECONOMY.gomoku.dailyCap;

  return (
    <div className="guess-game">
      <HostBubble text={line?.text ?? null} source={line?.source ?? null} pending={pending} />

      <div className="guess-status">
        <span>
          今日金币 {record?.earnedToday ?? 0}/{cap}
        </span>
        <span>连胜 {record?.streak ?? 0}</span>
        <span>最佳 {record?.bestStreak ?? 0}</span>
      </div>

      {!over && (
        <div className="gomoku-meta">
          <span className="muted">{aiThinking ? 'AI 思考中…' : playerTurn ? '轮到你了（黑）' : 'AI 落子中…'}</span>
          <div className="gomoku-difficulty">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`chip${difficulty === d.id ? ' chip-finished' : ''}`}
                onClick={() => setDifficulty(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="gomoku-board" role="grid" aria-label="五子棋棋盘">
        {board.map((row, r) =>
          row.map((stone, c) => {
            const isWin = winLine?.some(([wr, wc]) => wr === r && wc === c) ?? false;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                role="gridcell"
                className={`gomoku-cell${isWin ? ' gomoku-cell--win' : ''}`}
                onClick={() => playerMove(r, c)}
                disabled={over !== null || aiThinking || stone !== EMPTY}
                aria-label={`第 ${r + 1} 行第 ${c + 1} 列`}
              >
                {stone !== EMPTY && (
                  <span className={`gomoku-stone gomoku-stone--${stone === BLACK ? 'black' : 'white'}`} />
                )}
              </button>
            );
          })
        )}
      </div>

      {!over ? (
        <div className="guess-actions">
          <button type="button" className="btn" onClick={() => void finish('lost', null, '你认输了，这局算 AI 赢')}>
            认输
          </button>
          <HostModeSwitch />
        </div>
      ) : (
        <GameOverPanel
          summary={{
            gameId: 'gomoku',
            outcome: over,
            detail: overDetail,
            coins: settled?.gained ?? 0,
          }}
          title={over === 'won' ? '你赢了！' : over === 'lost' ? 'AI 赢了' : '平局'}
          detail={
            over === 'draw'
              ? '平局不奖不罚，战绩照常计入对局数'
              : `${overDetail}${settled && settled.gained > 0 ? `，获得 ${settled.gained} 金币` : ''}`
          }
          awardFailed={settled ? settled.gained > 0 && !settled.awarded : false}
          onRestart={restart}
        />
      )}
    </div>
  );
}

/** 统计一方棋子数（台词细节用）。 */
function countStones(board: Board, player: 1 | 2): number {
  return board.reduce((sum, row) => sum + row.filter((s) => s === player).length, 0);
}
