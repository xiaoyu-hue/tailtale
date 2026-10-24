import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../../../components';
import { useGameRecord, useHostMode, settleGameRound } from '../store';
import { fetchHostLine, type HostLine } from '../service';
import { GAME_ECONOMY, GAME_LABELS, buildQuizRound, type HostContext, type HostEvent, type QuizGameId } from '../model';
import { HostBubble } from './HostBubble';
import { HostModeSwitch } from './HostModeSwitch';
import { GameOverPanel } from './GameOverPanel';

/** 每局题数与及格线（PRD 配套玩法：10 题答对 6 题即胜）。 */
const ROUNDS = 10;
const PASS = 6;

/** 题干引导语（题库 prompt 为纯事实，引导语按游戏类型区分）。 */
const PROMPT_PREFIX: Record<QuizGameId, (prompt: string) => string> = {
  guess_idiom: (p) => `下面哪个成语的意思是：${p}`,
  guess_riddle: (p) => `“${p}”——下一句是？`,
  brain_teaser: (p) => p,
};

/**
 * 四选一猜词对局（Sheet 内容，猜成语 / 猜歇后语 / 脑筋急转弯共用）：
 * 每局 10 题、答对 6 题判胜（胜局 +2 金币，日上限 10）；题目由 seed 确定性
 * 生成（同 seed 同题），离开页面（关抽屉 / 切路由 / 刷新）视为无结果：
 * 不奖不罚、连胜保留、不写库——与猜数字口径一致。
 */
export function QuizGame({ gameId }: { gameId: QuizGameId }) {
  const record = useGameRecord(gameId);
  const hostMode = useHostMode();
  /** 每局种子基准（开局时取时间戳，保证局局题目不同） */
  const [base, setBase] = useState(() => Date.now());
  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [line, setLine] = useState<HostLine | null>(null);
  const [pending, setPending] = useState(false);
  const [settled, setSettled] = useState<{ gained: number; awarded: boolean } | null>(null);
  const startedRef = useRef(false);

  const quiz = buildQuizRound(gameId, base + round);
  const answered = picked !== null;
  const wasRight = answered && picked === quiz.answerIndex;
  const cap = GAME_ECONOMY[gameId].dailyCap;

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
      gameId,
      seed: record?.plays ?? 0,
      streak: record?.streak ?? 0,
      bestStreak: record?.bestStreak ?? 0,
      detail: `共 ${ROUNDS} 题，答对 ${PASS} 题即胜`,
    });
    // eslint 守卫生效中：仅挂载执行一次，record 通过 speak 时读取最新值
  }, [speak, record, gameId]);

  /** 结算并播台词（金币先落库发放，台词引用结算后的连胜数）。 */
  const finish = async (won: boolean) => {
    setOver(true);
    const settleResult = await settleGameRound(gameId, won);
    setSettled({ gained: settleResult.settlement.gained, awarded: settleResult.awarded });
    if (settleResult.settlement.gained > 0) {
      if (settleResult.awarded) toast.success(`获得 ${settleResult.settlement.gained} 金币`);
      else toast.error('战绩已记录，金币发放失败');
    }
    const streak = settleResult.settlement.record.streak;
    await speak(won ? 'win' : 'lose', {
      gameId,
      seed: (record?.plays ?? 0) + 1,
      streak,
      bestStreak: settleResult.settlement.record.bestStreak,
      detail: `已答对 ${correct + (picked === quiz.answerIndex ? 1 : 0)} 题${
        streak >= 3 ? `，${streak} 连胜！` : ''
      }`,
    });
  };

  const pick = (i: number) => {
    if (answered || over) return;
    setPicked(i);
    if (i === quiz.answerIndex) setCorrect((c) => c + 1);
  };

  const next = () => {
    const nextCorrect = correct;
    const isLast = round + 1 >= ROUNDS;
    if (isLast) {
      void finish(nextCorrect >= PASS);
      return;
    }
    setRound((r) => r + 1);
    setPicked(null);
  };

  const restart = () => {
    setBase(Date.now());
    setRound(0);
    setCorrect(0);
    setPicked(null);
    setOver(false);
    setSettled(null);
    setLine(null);
    void speak('start', {
      gameId,
      seed: (record?.plays ?? 0) + 1,
      streak: record?.streak ?? 0,
      bestStreak: record?.bestStreak ?? 0,
      detail: `共 ${ROUNDS} 题，答对 ${PASS} 题即胜`,
    });
  };

  if (over) {
    const won = correct >= PASS;
    const coins = settled?.gained ?? 0;
    return (
      <div className="guess-game">
        <HostBubble text={line?.text ?? null} source={line?.source ?? null} pending={pending} />
        <GameOverPanel
          summary={{
            gameId,
            outcome: won ? 'won' : 'lost',
            detail: `${ROUNDS} 题答对 ${correct} 题`,
            coins,
          }}
          title={won ? '过关！' : '差一点儿'}
          detail={`本局 ${ROUNDS} 题答对 ${correct} 题${coins > 0 ? `，获得 ${coins} 金币` : '，再接再厉'}`}
          awardFailed={settled ? coins > 0 && !settled.awarded : false}
          onRestart={restart}
        />
      </div>
    );
  }

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

      <p className="muted guess-remaining">
        第 {round + 1}/{ROUNDS} 题 · 已答对 {correct} · 答对 {PASS} 题即胜
      </p>

      <div className="quiz-prompt">
        <span className="quiz-prompt-tag">{GAME_LABELS[gameId]}</span>
        <p>{PROMPT_PREFIX[gameId](quiz.prompt)}</p>
      </div>

      <div className="quiz-options">
        {quiz.options.map((opt, i) => {
          const cls =
            !answered
              ? 'quiz-option'
              : i === quiz.answerIndex
                ? 'quiz-option quiz-option--right'
                : i === picked
                  ? 'quiz-option quiz-option--wrong'
                  : 'quiz-option quiz-option--dim';
          return (
            <button
              key={`${round}-${i}`}
              type="button"
              className={cls}
              onClick={() => pick(i)}
              disabled={answered}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {answered && (
        <>
          <p className={`quiz-feedback${wasRight ? ' quiz-feedback--right' : ' quiz-feedback--wrong'}`}>
            {wasRight ? '答对了！' : `答错了，正确答案是「${quiz.answer}」`}
          </p>
          <div className="guess-actions">
            <button type="button" className="btn btn-primary" onClick={next}>
              {round + 1 >= ROUNDS ? '看结果' : '下一题'}
            </button>
          </div>
        </>
      )}

      {!answered && (
        <div className="guess-actions">
          <button type="button" className="btn" onClick={() => void finish(false)}>
            放弃本局
          </button>
          <HostModeSwitch />
        </div>
      )}
    </div>
  );
}
