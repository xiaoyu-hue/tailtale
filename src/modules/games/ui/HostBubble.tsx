import { useEffect, useRef, useState } from 'react';

/** 打字机间隔（毫秒/字）：纯 UI 层「等得住」体验，不依赖流式输出。 */
const TYPE_INTERVAL_MS = 40;

export interface HostBubbleProps {
  /** 完整台词（null 表示暂无） */
  text: string | null;
  /** 台词来源（null 表示未生成） */
  source: 'ai' | 'local' | null;
  /** 是否正在等待台词（AI 生成中） */
  pending?: boolean;
}

/**
 * 主持人台词气泡（速查表「等得住 / 信得过」的游戏化落地）：
 * 打字机效果 + 来源徽标（AI 生成免责 / 本地主持人）。
 * 打字为本地动画，无需改造网络层；点击气泡跳过动画直接显示全文。
 */
export function HostBubble({ text, source, pending = false }: HostBubbleProps) {
  const [shown, setShown] = useState('');
  const timerRef = useRef(0);

  useEffect(() => {
    window.clearInterval(timerRef.current);
    if (!text) {
      setShown('');
      return;
    }
    setShown('');
    let i = 0;
    timerRef.current = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(timerRef.current);
    }, TYPE_INTERVAL_MS);
    return () => window.clearInterval(timerRef.current);
  }, [text]);

  if (pending) {
    return (
      <div className="host-bubble host-bubble--pending">
        <span className="host-bubble-avatar" aria-hidden="true">
          🎙
        </span>
        <p className="host-bubble-text muted">主持人正在想…</p>
      </div>
    );
  }

  if (!text) return null;

  const done = shown.length >= text.length;
  const skip = () => {
    window.clearInterval(timerRef.current);
    setShown(text);
  };

  return (
    <div
      className="host-bubble"
      onClick={done ? undefined : skip}
      role={done ? undefined : 'button'}
      title={done ? undefined : '点击跳过动画'}
    >
      <span className="host-bubble-avatar" aria-hidden="true">
        🎙
      </span>
      <div className="host-bubble-main">
        <p className="host-bubble-text">{shown}</p>
        <div className="host-bubble-foot">
          {source === 'ai' ? (
            <span className="ai-badge">AI 生成，仅供参考</span>
          ) : (
            <span className="host-bubble-src muted">本地主持人</span>
          )}
          {!done && <span className="host-bubble-skip muted">点击跳过</span>}
        </div>
      </div>
    </div>
  );
}
