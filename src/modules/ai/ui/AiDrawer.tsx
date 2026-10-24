import { useEffect, useRef, useState } from 'react';
import type { Book } from '../../books';
import { CostDialog } from './CostDialog';
import { describeAiError, type AiErrorInfo, type CostEstimate } from '../model';
import { ask, getCachedOutline, prepareExplain, runOutline, type CachedOutline } from '../store';

interface AiDrawerProps {
  book: Book;
  onClose: () => void;
}

type OutlinePhase = 'idle' | 'estimating' | 'confirm' | 'running' | 'done' | 'error';
type AskPhase = 'idle' | 'running' | 'error';

interface PrepareState {
  text: string;
  estimate: CostEstimate;
  warning?: string;
}

/**
 * 阅读器 AI 抽屉（M5）：全书大纲/摘要 + 针对本书提问。
 * - 大纲：生成前先预估费用并弹窗确认（PRD §5.3 成本控制）；
 * - 提问：基于本会话已生成的大纲回答，未生成则引导先生成；
 * - 所有 AI 输出带「AI 生成，仅供参考」标注；
 * - 关闭抽屉即中止进行中的请求，避免后台继续扣费。
 */
export function AiDrawer({ book, onClose }: AiDrawerProps) {
  const [tab, setTab] = useState<'outline' | 'ask'>('outline');
  const [phase, setPhase] = useState<OutlinePhase>('idle');
  const [prepare, setPrepare] = useState<PrepareState | null>(null);
  const [outline, setOutline] = useState<CachedOutline | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<AiErrorInfo | null>(null);

  const [question, setQuestion] = useState('');
  const [askPhase, setAskPhase] = useState<AskPhase>('idle');
  const [answer, setAnswer] = useState('');
  const [askError, setAskError] = useState<AiErrorInfo | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // 挂载时恢复会话缓存：本会话已生成过大纲则直接展示，不重复付费
  useEffect(() => {
    const cached = getCachedOutline(book.id);
    if (cached) {
      setOutline(cached);
      setPhase('done');
    }
  }, [book.id]);

  // 卸载时中止进行中的请求
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const handleGenerate = async (): Promise<void> => {
    setPhase('estimating');
    setError(null);
    try {
      const result = await prepareExplain(book);
      setPrepare(result);
      setPhase('confirm');
    } catch (e) {
      setError(describeAiError(e));
      setPhase('error');
    }
  };

  const handleConfirm = async (): Promise<void> => {
    if (!prepare) return;
    setPhase('running');
    setProgress({ done: 0, total: 0 });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const cached = await runOutline(book, prepare.text, {
        onProgress: (done, total) => setProgress({ done, total }),
        signal: controller.signal,
      });
      setOutline(cached);
      setPhase('done');
    } catch (e) {
      const info = describeAiError(e);
      if (info.code === 'aborted') setPhase('confirm'); // 用户主动取消，回到预估窗
      else {
        setError(info);
        setPhase('error');
      }
    } finally {
      abortRef.current = null;
    }
  };

  const handleAsk = async (): Promise<void> => {
    const q = question.trim();
    if (!q) return;
    setAskPhase('running');
    setAskError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await ask(book.id, q, controller.signal);
      setAnswer(result);
      setQuestion('');
      setAskPhase('idle');
    } catch (e) {
      const info = describeAiError(e);
      if (info.code === 'aborted') setAskPhase('idle');
      else {
        setAskError(info);
        setAskPhase('error');
      }
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <>
      <div className="reader-drawer-mask" onClick={onClose} />
      <aside className="reader-drawer ai-drawer">
        <div className="reader-drawer-title">
          <span>AI 解读《{book.title}》</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="ai-tabs">
          <button
            type="button"
            className={`ai-tab${tab === 'outline' ? ' active' : ''}`}
            onClick={() => setTab('outline')}
          >
            大纲
          </button>
          <button
            type="button"
            className={`ai-tab${tab === 'ask' ? ' active' : ''}`}
            onClick={() => setTab('ask')}
          >
            提问
          </button>
        </div>

        {tab === 'outline' ? (
          <div className="ai-panel">
            {phase === 'idle' && (
              <>
                <p className="muted">
                  基于全书内容生成结构化大纲：先一句话概述，再分级列出脉络，末尾总结核心。生成前会先预估费用，确认后才调用。
                </p>
                <button type="button" className="btn btn-primary btn-block" onClick={handleGenerate}>
                  生成大纲
                </button>
              </>
            )}

            {phase === 'estimating' && (
              <p className="muted">
                {book.format === 'epub'
                  ? '正在读取 EPUB 全书文本…'
                  : book.format === 'mobi' || book.format === 'azw3'
                    ? '正在读取 MOBI 全书文本…'
                    : '正在分析全书篇幅，估算费用…'}
              </p>
            )}

            {phase === 'confirm' && prepare && (
              <CostDialog
                estimate={prepare.estimate}
                warning={prepare.warning}
                onConfirm={handleConfirm}
                onCancel={() => setPhase('idle')}
              />
            )}

            {phase === 'running' && (
              <div className="ai-running">
                <p className="muted">
                  {progress.total > 0
                    ? `正在分析第 ${progress.done}/${progress.total} 段…`
                    : '正在调用模型生成大纲…'}
                </p>
                {progress.total > 0 && (
                  <div className="ai-progress">
                    <div
                      className="ai-progress-bar"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                )}
                <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
                  取消
                </button>
              </div>
            )}

            {phase === 'done' && outline && (
              <div className="ai-result-wrap">
                <pre className="ai-result">{outline.outline}</pre>
                <div className="ai-result-foot">
                  <span className="ai-badge">AI 生成，仅供参考</span>
                  <span className="muted">
                    调用 {outline.calls} 次 · 约 {outline.inputTokens.toLocaleString()} tokens
                  </span>
                </div>
                {outline.truncated && (
                  <p className="ai-dialog-warning">全书过长，大纲基于前约 16 万字生成。</p>
                )}
                <button type="button" className="btn" onClick={handleGenerate}>
                  重新生成
                </button>
              </div>
            )}

            {phase === 'error' && error && (
              <div className="ai-error">
                <p className="ai-error-message">{error.message}</p>
                <p className="muted">{error.hint}</p>
                <button type="button" className="btn btn-primary" onClick={handleGenerate}>
                  重试
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="ai-panel">
            {outline ? (
              <>
                <label className="ai-field">
                  <span className="settings-label">针对《{book.title}》提问</span>
                  <textarea
                    className="ai-input ai-textarea"
                    rows={3}
                    value={question}
                    placeholder="例如：这本书的核心观点是什么？"
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={askPhase === 'running' || !question.trim()}
                  onClick={handleAsk}
                >
                  {askPhase === 'running' ? '思考中…' : '提问'}
                </button>
                {askPhase === 'running' && <p className="muted">正在基于大纲回答…</p>}
                {answer && (
                  <div className="ai-result-wrap">
                    <pre className="ai-result">{answer}</pre>
                    <div className="ai-result-foot">
                      <span className="ai-badge">AI 生成，仅供参考</span>
                    </div>
                  </div>
                )}
                {askPhase === 'error' && askError && (
                  <div className="ai-error">
                    <p className="ai-error-message">{askError.message}</p>
                    <p className="muted">{askError.hint}</p>
                    <button type="button" className="btn" onClick={handleAsk}>
                      重试
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="muted">
                  提问基于全书大纲回答（上下文可控、费用可控）。请先在「大纲」标签生成大纲。
                </p>
                <button type="button" className="btn" onClick={() => setTab('outline')}>
                  去生成大纲
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
