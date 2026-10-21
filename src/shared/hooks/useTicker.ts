import { useEffect, useState } from 'react';

/**
 * 按固定间隔返回「当前时间戳」（驱动冷却倒计时等场景重渲染）。
 * 组件卸载即清理定时器；首帧用挂载时的 Date.now()，不等待首个间隔。
 */
export function useTicker(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
