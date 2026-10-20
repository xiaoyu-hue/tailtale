import { useEffect, useState } from 'react';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function formatNow(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 周${WEEKDAYS[date.getDay()]} ${hh}:${mm}`;
}

/** 顶部栏：日期时间。金币余额将在 M3 金币系统上线后补充。 */
export default function TopBar() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <span className="topbar-date">{formatNow(now)}</span>
      <span className="topbar-brand">书时</span>
    </header>
  );
}
