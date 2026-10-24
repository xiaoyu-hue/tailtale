import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../../../components';
import { useGameRecord, useHostMode, settleGameRound } from '../store';
import { fetchHostLine, type HostLine } from '../service';
import { GAME_ECONOMY, type HostContext, type HostEvent } from '../model';
import { HostBubble } from './HostBubble';
import { HostModeSwitch } from './HostModeSwitch';
import { GameOverPanel } from './GameOverPanel';

/** 猜数字规则（PRD §3.1.1 配套玩法；log₂100≈6.64，7 次保证可必胜）。 */
const RANGE_MIN = 1;
const RANGE_MAX = 100;
const ROUNDS = 7;
const NEAR_GAP = 5;

type Outcome = 'won' | 'lost' | 'gaveup';

interface Guess {
  value: number;
  /** up=猜小了（答案更大）；down=猜大了；hit=猜中 */
  dir: 'up' | 'down' | 'hit';
}

/**
 * 猜数字对局（Sheet 内容）：
 * 1-100 猜 7 次；猜中连胜 +1 金币（日上限 5），机会用完或主动放弃判负。
 * 离开页面（关抽屉 / 切路由 / 刷新）视为无结果：不奖不罚、连胜保留、
 * 不写库——放弃判定不挂 unmount，避免 React StrictMode 双挂载误断连胜。
 */
export function GuessNumberGame() {
  const record = useGameRecord('guess_number');
  const hostMode = useHostMode();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [answer, setAnswer] = useState(() => RANGE_MIN + Math.floor(Math.random() * RANGE_MAX));
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const [line, setLine] = useState<HostLine | null>(null);
  const [pending, setPending] = useState(false);
  const [settled, setSettled] = useState<{ gained: number; awarded: boolean } | null>(null);
  /** 本局实际猜的次数（结束面板与 AI 点评的事实来源） */
  const [used, setUsed] = useState(0);
  /** 开局台词守卫：StrictMode 双挂载只请求一次，避免 AI 模式重复付费 */
  const startedRef = useRef(false);

  const over = outcome !== null;
  const remaining = ROUNDS - guesses.length;

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

  // 开局台词（seed 用当前总局数，同局确定性轮换）
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void speak('start', {
      gameId: 'guess_number',
      seed: record?.plays ?? 0,
      streak: record?.streak ?? 0,
      bestStreak: record?.bestStreak ?? 0,
      detail: `数字在 ${RANGE_MIN} 到 ${RANGE_MAX} 之间，共 ${ROUNDS} 次机会`,
    });
    // eslint 守卫生效中：仅挂载执行一次，record 通过 speak 时读取最新值
  }, [speak, record]);

  const submit = () => {
    if (over) return;
    const value = Number(input.trim());
    if (!Number.isInteger(value) || value < RANGE_MIN || value > RANGE_MAX) {
      setNotice(`请输入 ${RANGE_MIN} 到 ${RANGE_MAX} 之间的整数`);
      return;
    }
    if (guesses.some((g) => g.value === value)) {
      setNotice('这个数猜过了');
      return;
    }
    setNotice('');
    const dir: Guess['dir'] = value === answer ? 'hit' : value < answer ? 'up' : 'down';
    const nextGuesses = [...guesses, { value, dir }];
    setGuesses(nextGuesses);
    setInput('');
    if (value === answer) {
      void finish('won', nextGuesses.length);
      return;
    }
    if (nextGuesses.length >= ROUNDS) {
      void finish('lost', nextGuesses.length);
      return;
    }
    // 差一点才叫主持人（普通大小提示是本地文案，不走 AI——控费关键）
    if (Math.abs(value - answer) <= NEAR_GAP) {
      void speak('near', {
        gameId: 'guess_number',
        seed: nextGuesses.length,
        streak: record?.streak ?? 0,
        bestStreak: record?.bestStreak ?? 0,
        detail: `比 ${value} ${value < answer ? '大' : '小'}一些，还剩 ${ROUNDS - nextGuesses.length} 次机会`,
      });
    }
  };

  /** 结算并播对应台词（金币先落库发放，台词引用结算后的连胜数）。 */
  const finish = async (result: Outcome, usedCount: number) => {
    setOutcome(result);
    setUsed(usedCount);
    const won = result === 'won';
    const settleResult = await settleGameRound('guess_number', won);
    setSettled({ gained: settleResult.settlement.gained, awarded: settleResult.awarded });
    if (settleResult.settlement.gained > 0) {
      if (settleResult.awarded) toast.success(`获得 ${settleResult.settlement.gained} 金币`);
      else toast.error('战绩已记录，金币发放失败');
    }
    const streak = settleResult.settlement.record.streak;
    const detail = won
      ? `用了 ${usedCount} 次猜中${streak >= 3 ? `，${streak} 连胜！` : ''}`
      : `答案是 ${answer}`;
    await speak(won ? 'win' : result === 'lost' ? 'lose' : 'giveUp', {
      gameId: 'guess_number',
      seed: (record?.plays ?? 0) + 1,
      streak,
      bestStreak: settleResult.settlement.record.bestStreak,
      detail,
    });
  };

  const restart = () => {
    setOutcome(null);
    setAnswer(RANGE_MIN + Math.floor(Math.random() * RANGE_MAX));
    setGuesses([]);
    setInput('');
    setNotice('');
    setSettled(null);
    setUsed(0);
    setLine(null);
    void speak('start', {
      gameId: 'guess_number',
      seed: (record?.plays ?? 0) + 1,
      streak: record?.streak ?? 0,
      bestStreak: record?.bestStreak ?? 0,
      detail: `数字在 ${RANGE_MIN} 到 ${RANGE_MAX} 之间，共 ${ROUNDS} 次机会`,
    });
  };

  const cap = GAME_ECONOMY.guess_number.dailyCap;

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
        <p className="muted guess-remaining">
          还剩 {remaining} 次机会 · 我想好了一个 {RANGE_MIN} 到 {RANGE_MAX} 的整数
        </p>
      )}

      {guesses.length > 0 && (
        <div className="guess-history">
          {guesses.map((g) => (
            <span key={g.value} className={`chip${g.dir === 'hit' ? ' chip-finished' : ' chip-reading'}`}>
              {g.value}
              {g.dir === 'hit' ? ' ✓' : g.dir === 'up' ? ' ↑' : ' ↓'}
            </span>
          ))}
        </div>
      )}

      {!over && (
        <form
          className="guess-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            className="ai-input"
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`输入 ${RANGE_MIN}-${RANGE_MAX} 的整数`}
            aria-label="你的猜测"
          />
          <button type="submit" className="btn btn-primary">
            猜
          </button>
        </form>
      )}

      {notice && <p className="muted guess-notice">{notice}</p>}

      {!over ? (
        <div className="guess-actions">
          <button type="button" className="btn" onClick={() => void finish('gaveup', guesses.length)}>
            放弃本局
          </button>
          <HostModeSwitch />
        </div>
      ) : (
        <GameOverPanel
          summary={{
            gameId: 'guess_number',
            outcome: outcome === 'won' ? 'won' : 'lost',
            detail: outcome === 'won' ? `用了 ${used} 次猜中` : `答案是 ${answer}`,
            coins: settled?.gained ?? 0,
          }}
          title={outcome === 'won' ? '猜中啦！' : outcome === 'lost' ? '机会用完了' : '已放弃本局'}
          detail={`${outcome === 'won' ? `用了 ${used} 次猜中` : `答案是 ${answer}`}${
            settled && settled.gained > 0 ? `，获得 ${settled.gained} 金币` : ''
          }`}
          awardFailed={settled ? settled.gained > 0 && !settled.awarded : false}
          onRestart={restart}
        />
      )}
    </div>
  );
}
