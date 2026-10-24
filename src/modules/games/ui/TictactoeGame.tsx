import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../../../components';
import { useGameRecord, useHostMode, settleGameRound, recordDraw } from '../store';
import { fetchHostLine, type HostLine } from '../service';
import { GAME_ECONOMY, type HostContext, type HostEvent } from '../model';
import {
  AI,
  EMPTY,
  PLAYER,
  bestMove,
  createBoard,
  findWin,
  isFull,
  isValidMove,
  placeMark,
  type Board,
  type Difficulty,
} from '../tictactoe';
import { HostBubble } from './HostBubble';
import { HostModeSwitch } from './HostModeSwitch';
import { GameOverPanel } from './GameOverPanel';

/** AI 应手延迟（毫秒）：与五子棋一致的思考节奏。 */
const AI_DELAY_MS = 350;

const DIFFICULTIES: Array<{ id: Difficulty; label: string }> = [
  { id: 'easy', label: '简单' },
  { id: 'medium', label: '中等' },
  { id: 'hard', label: '困难' },
];

type RoundResult = 'won' | 'lost' | 'draw';

/**
 * 井字棋对局（Sheet 内容）：3×3 棋盘，玩家执 X 先手，AI 执 O
 * （自研教科书 minimax，hard 不可战胜）。胜局 +2 金币（日上限 6）；
 * 平局不奖不罚不写库（与五子棋同口径）。
 */
export function TictactoeGame() {
  const record = useGameRecord('tictactoe');
  const hostMode = useHostMode();
  const [board, setBoard] = useState<Board>(createBoard);
  const [playerTurn, setPlayerTurn] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [winLine, setWinLine] = useState<readonly [number, number, number] | null>(null);
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
      gameId: 'tictactoe',
      seed: record?.plays ?? 0,
      streak: record?.streak ?? 0,
      bestStreak: record?.bestStreak ?? 0,
      detail: '你执 X 先手，先成三子者胜',
    });
    // eslint 守卫生效中：仅挂载执行一次，record 通过 speak 时读取最新值
  }, [speak, record]);

  /** 结算并播台词（金币先落库发放；平局不结算——不奖不罚不写库）。 */
  const finish = async (result: RoundResult, win: readonly [number, number, number] | null, detail: string) => {
    setOver(result);
    setOverDetail(detail);
    setWinLine(win);
    if (result === 'draw') {
      void recordDraw('tictactoe');
      await speak('draw', {
        gameId: 'tictactoe',
        seed: (record?.plays ?? 0) + 1,
        streak: record?.streak ?? 0,
        bestStreak: record?.bestStreak ?? 0,
        detail,
      });
      return;
    }
    const won = result === 'won';
    const settleResult = await settleGameRound('tictactoe', won);
    setSettled({ gained: settleResult.settlement.gained, awarded: settleResult.awarded });
    if (settleResult.settlement.gained > 0) {
      if (settleResult.awarded) toast.success(`获得 ${settleResult.settlement.gained} 金币`);
      else toast.error('战绩已记录，金币发放失败');
    }
    await speak(won ? 'win' : 'lose', {
      gameId: 'tictactoe',
      seed: (record?.plays ?? 0) + 1,
      streak: settleResult.settlement.record.streak,
      bestStreak: settleResult.settlement.record.bestStreak,
      detail,
    });
  };

  const playerMove = (i: number) => {
    if (over || aiThinking || !playerTurn || !isValidMove(board, i)) return;
    const next = placeMark(board, i, PLAYER);
    setBoard(next);
    setPlayerTurn(false);
    const playerWin = findWin(next);
    if (playerWin) {
      void finish('won', playerWin.line, '你先成三，赢得漂亮');
      return;
    }
    if (isFull(next)) {
      void finish('draw', null, '棋盘下满，无人成三');
      return;
    }
    setAiThinking(true);
    // AI 搜索前让出一帧，保证「思考中」状态先渲染
    window.setTimeout(() => {
      const aiIndex = bestMove(next, difficulty);
      const aiBoard = placeMark(next, aiIndex, AI);
      setAiThinking(false);
      setPlayerTurn(true);
      const aiWin = findWin(aiBoard);
      if (aiWin) {
        void finish('lost', aiWin.line, 'AI 先成三，输了');
        setBoard(aiBoard);
        return;
      }
      if (isFull(aiBoard)) {
        void finish('draw', null, '棋盘下满，无人成三');
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
      gameId: 'tictactoe',
      seed: (record?.plays ?? 0) + 1,
      streak: record?.streak ?? 0,
      bestStreak: record?.bestStreak ?? 0,
      detail: '你执 X 先手，先成三子者胜',
    });
  };

  const cap = GAME_ECONOMY.tictactoe.dailyCap;

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
          <span className="muted">{aiThinking ? 'AI 思考中…' : playerTurn ? '轮到你了（X）' : 'AI 落子中…'}</span>
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

      <div className="tictactoe-board" role="grid" aria-label="井字棋棋盘">
        {board.map((mark, i) => {
          const isWin = winLine?.includes(i) ?? false;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={`tictactoe-cell${isWin ? ' tictactoe-cell--win' : ''}`}
              onClick={() => playerMove(i)}
              disabled={over !== null || aiThinking || mark !== EMPTY}
              aria-label={`第 ${Math.floor(i / 3) + 1} 行第 ${i % 3 + 1} 列`}
            >
              {mark !== EMPTY && <span className={`tictactoe-mark tictactoe-mark--${mark === PLAYER ? 'x' : 'o'}`}>{mark === PLAYER ? 'X' : 'O'}</span>}
            </button>
          );
        })}
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
            gameId: 'tictactoe',
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
