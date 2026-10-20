import { useEffect, useState } from 'react';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function formatNow(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 周${WEEKDAYS[date.getDay()]} ${hh}:${mm}`;
}

function CoinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9 10.5h6M9 13.5h6" />
    </svg>
  );
}

/** 顶部栏：日期时间与金币余额（coins 由 App 从 gamification 模块注入，本组件不依赖模块）。 */
export default function TopBar({ coins }: { coins: number }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <span className="topbar-date">{formatNow(now)}</span>
      <span className="topbar-right">
        <span className="topbar-coins">
          <CoinIcon />
          {coins}
        </span>
        <span className="topbar-brand">书时</span>
      </span>
    </header>
  );
}
