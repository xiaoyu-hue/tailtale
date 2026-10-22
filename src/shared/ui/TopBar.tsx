import { useEffect, useRef, useState } from 'react';
import { formatDateLabel } from '../dates';
import { useTicker } from '../hooks/useTicker';

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function CoinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9 10.5h6M9 13.5h6" />
    </svg>
  );
}

/** 金币余额变化时的一次性飘字（seq 作 key：重挂载即重播动画，动画结束自动清除）。 */
interface CoinFloat {
  seq: number;
  delta: number;
}

/** 顶部栏：实时日期时间（秒级）与金币余额（coins 由 App 从 gamification 模块注入，本组件不依赖模块）。 */
export default function TopBar({ coins }: { coins: number }) {
  const now = useTicker(1000); // 秒级实时，驱动时钟与跨天切换
  const date = new Date(now);

  // 金币飘字：余额变化时记录一次增量（首帧 0 → 实际值也播，作为「到账」反馈）
  const [coinFloat, setCoinFloat] = useState<CoinFloat | null>(null);
  const prevCoinsRef = useRef(coins);
  const floatSeqRef = useRef(0);
  useEffect(() => {
    const previous = prevCoinsRef.current;
    prevCoinsRef.current = coins;
    if (coins === previous) return;
    // 减少动画开启时不飘字：CSS 动画被通杀后 animationend 不触发，飘字会残留
    if (document.documentElement.dataset.reduceMotion === 'on') return;
    floatSeqRef.current += 1;
    setCoinFloat({ seq: floatSeqRef.current, delta: coins - previous });
    // 兜底清理：动画进行中开关被切换等异常路径下，1s 后强制清除
    const timer = window.setTimeout(() => setCoinFloat(null), 1000);
    return () => window.clearTimeout(timer);
  }, [coins]);

  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());

  return (
    <header className="topbar">
      <span className="topbar-date">
        {formatDateLabel(date)}{' '}
        <span className="topbar-clock">
          {hh}
          <span className="topbar-colon">:</span>
          {mm}
          <span className="topbar-colon">:</span>
        </span>
        <span className="topbar-seconds" key={ss}>
          {ss}
        </span>
      </span>
      <span className="topbar-right">
        <span className="topbar-coins">
          <CoinIcon />
          {coins}
          {coinFloat && (
            <span
              key={coinFloat.seq}
              className={`coin-float ${coinFloat.delta >= 0 ? 'is-up' : 'is-down'}`}
              onAnimationEnd={() => setCoinFloat(null)}
            >
              {coinFloat.delta >= 0 ? `+${coinFloat.delta}` : coinFloat.delta}
            </span>
          )}
        </span>
        <span className="topbar-brand">书时</span>
      </span>
    </header>
  );
}
