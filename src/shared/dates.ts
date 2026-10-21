/**
 * 日期工具：本地时区日期键（YYYY-MM-DD）与平移。
 * 跨模块共享（gamification 的打卡、pet 的每日计数均按日期键跨天重置），
 * 故置于 shared 层；不依赖任何模块与平台 API，可独立单测。
 */

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 本地时区日期键 YYYY-MM-DD（不能用 toISOString，那是 UTC 会差一天）。 */
export function formatKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): string {
  return formatKey(now);
}

/** 日期键平移 days 天（负数为往前；按本地时区，自动处理月末跨月）。 */
export function shiftDay(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return formatKey(new Date(year, month - 1, day + days));
}
