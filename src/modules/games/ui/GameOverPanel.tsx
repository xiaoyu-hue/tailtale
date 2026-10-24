import { useState } from 'react';
import { toast } from '../../../components';
import { useAiConfigured } from '../../ai';
import { useHostMode } from '../store';
import { fetchAiText } from '../service';
import {
  buildFollowUpPrompt,
  buildReviewPrompt,
  suggestFollowUps,
  type FollowUpTurn,
  type GameSummary,
} from '../model';
import { HostBubble } from './HostBubble';

export interface GameOverPanelProps {
  /** 对局小结（AI 点评与追问的事实来源；与结算结果同源） */
  summary: GameSummary;
  /** 结果标题（如「猜中啦！」「AI 赢了」「平局」） */
  title: string;
  /** 结果说明（muted；金币到账信息由调用方拼入） */
  detail: string;
  /** 金币已记录但发放失败（展示轻提示） */
  awardFailed?: boolean;
  onRestart: () => void;
}

/**
 * 对局结束面板（四个对局 + 四选一共用；替换原先各局内联的 guess-over）：
 * 结果 + 金币 + 「再来一局 / 换个游戏」+ AI 点评区。
 *
 * 控费原则（与主持人双模式同口径）：
 * - 点评与追问全部用户主动触发，平均每局 0~2 次 AI 调用；
 * - AI 主持人关闭（local）时点击引导开启，未配置密钥时引导去「我的」页，
 *   两者都不发请求；生成失败 toast 轻提示，不阻塞「再来一局」。
 */
export function GameOverPanel({ summary, title, detail, awardFailed = false, onRestart }: GameOverPanelProps) {
  const hostMode = useHostMode();
  const aiConfigured = useAiConfigured();
  const [review, setReview] = useState<string | null>(null);
  const [reviewPending, setReviewPending] = useState(false);
  /** 追问历史（含最新一轮；上下文以拼接方式传入，无会话缓存） */
  const [history, setHistory] = useState<FollowUpTurn[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [answerPending, setAnswerPending] = useState(false);
  const [question, setQuestion] = useState('');

  const busy = reviewPending || answerPending;

  /** AI 可用性守卫：返回 false 时已 toast 引导，调用方直接返回。 */
  const guardAi = (): boolean => {
    if (hostMode !== 'ai') {
      toast.info('打开「AI 主持人」开关后，可让 AI 点评本局');
      return false;
    }
    if (!aiConfigured) {
      toast.info('请先到「我的」页配置 AI 密钥');
      return false;
    }
    return true;
  };

  const askReview = async () => {
    if (busy || !guardAi()) return;
    setReviewPending(true);
    try {
      const { system, user } = buildReviewPrompt(summary);
      const text = await fetchAiText(system, user);
      if (text) setReview(text);
      else toast.error('点评生成失败，请稍后再试');
    } finally {
      setReviewPending(false);
    }
  };

  const askFollowUp = async (q: string) => {
    const text = q.trim();
    if (busy || !text || !guardAi()) return;
    setAnswerPending(true);
    setQuestion('');
    try {
      const { system, user } = buildFollowUpPrompt(summary, history, text);
      const reply = await fetchAiText(system, user);
      if (!reply) {
        setQuestion(text); // 失败保留输入，便于重试
        toast.error('回答生成失败，请稍后再试');
        return;
      }
      setHistory((h) => [...h, { role: 'user', content: text }, { role: 'assistant', content: reply }]);
      setAnswer(reply);
    } finally {
      setAnswerPending(false);
    }
  };

  // 最新一轮回答在打字机气泡里，历史列表只展示更早的轮次（避免重复）
  const shownHistory = answer ? history.slice(0, -2) : history;

  return (
    <div className="guess-over">
      <p className="guess-over-title">{title}</p>
      <p className="muted">{detail}</p>
      {awardFailed && <p className="muted">金币发放失败，战绩已记录</p>}
      <div className="guess-chips">
        <button type="button" className="chip" onClick={onRestart}>
          再来一局
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => toast.info('更多游戏在游戏目录里，去看看吧')}
        >
          换个游戏
        </button>
      </div>

      <div className="game-over-ai">
        <div className="guess-chips">
          <button type="button" className="chip" onClick={() => void askReview()} disabled={busy}>
            {review ? '重新点评' : 'AI 点评'}
          </button>
          <span className="muted game-over-ai-hint">AI 生成仅供参考 · 每次约 0.003 元</span>
        </div>

        {reviewPending && <HostBubble text={null} source={null} pending />}
        {review && !reviewPending && <HostBubble text={review} source="ai" />}

        {review && (
          <>
            <div className="game-over-suggests">
              {suggestFollowUps(summary).map((q) => (
                <button
                  key={q}
                  type="button"
                  className="chip"
                  onClick={() => void askFollowUp(q)}
                  disabled={busy}
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              className="guess-input-row"
              onSubmit={(e) => {
                e.preventDefault();
                void askFollowUp(question);
              }}
            >
              <input
                className="ai-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="还想问什么？"
                aria-label="追问输入框"
                disabled={busy}
              />
              <button type="submit" className="btn btn-primary" disabled={busy || !question.trim()}>
                问
              </button>
            </form>
          </>
        )}

        {shownHistory.length > 0 && (
          <div className="game-over-qa">
            {shownHistory.map((turn, i) => (
              <p key={i} className={turn.role === 'user' ? 'game-over-q' : 'game-over-a'}>
                {turn.role === 'user' ? '你' : '主持人'}：{turn.content}
              </p>
            ))}
          </div>
        )}

        {answerPending && <HostBubble text={null} source={null} pending />}
        {answer && !answerPending && <HostBubble text={answer} source="ai" />}
      </div>
    </div>
  );
}
