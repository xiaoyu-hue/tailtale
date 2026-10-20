/**
 * gamification 模块领域模型：经济数值、纯函数、持久化类型。
 * 本文件不依赖 React / DOM / IndexedDB，可独立单测。
 * 数值权威来源：docs/书时-PRD.md §3.1.1，改动须先改 PRD。
 */

/** 经济数值（PRD §3.1.1）。 */
export const ECONOMY = {
  /** 阅读奖励周期：每累计这么多分钟 */
  COINS_PER_MINUTES: 30,
  /** 每个周期奖励的金币 */
  COINS_PER_BLOCK: 10,
  /** 每日打卡基础金币 */
  CHECKIN_COINS: 5,
  /** 打卡所需当日最低阅读分钟数 */
  CHECKIN_MIN_MINUTES: 1,
  /** 连续打卡奖励起始天数（第 3 天起） */
  STREAK_FROM_DAY: 3,
  /** 连续打卡奖励每日递增金币 */
  STREAK_STEP: 2,
  /** 连续打卡奖励上限 */
  STREAK_CAP: 10,
  /** 读完一本书的一次性金币 */
  BOOK_FINISH_COINS: 100,
  /** 每阅读 1 分钟获得的 XP */
  XP_PER_MINUTE: 1,
} as const;

/** 钱包单例行的 id（wallet store 只有一行）。 */
export const WALLET_ID = 'wallet';
/** 阅读会话单例行的 id（reading_session store 只有一行）。 */
export const SESSION_ID = 'current';

/** 金币钱包：单例行，附带今日阅读统计（供打卡门槛与首页卡片）。 */
export interface Wallet {
  id: typeof WALLET_ID;
  coins: number;
  xp: number;
  /** 今日阅读分钟数所属日期键，跨天自动重置 */
  todayDate: string;
  /** 今日累计阅读分钟数（只算整分钟） */
  todayMinutes: number;
}

/** 打卡记录：一天一行，id 为日期键。 */
export interface Checkin {
  id: string;
  date: string;
  /** 本次打卡后的连续天数 */
  streak: number;
  /** 本次连续奖励（不含基础金币） */
  bonus: number;
  createdAt: number;
}

/** 阅读会话持久化行：单例，支持刷新页面后继续计时。 */
export interface PersistedSession {
  id: typeof SESSION_ID;
  bookId: string;
  /** 本会话累计阅读毫秒数 */
  accumulatedMs: number;
  /** 已计入今日阅读统计的分钟数（防刷新后重复计入） */
  minutesCounted: number;
  /** 本会话已发放的 XP */
  xpAwarded: number;
  /** 本会话已发放的金币 */
  coinsAwarded: number;
  updatedAt: number;
}

/** 内存中的活跃会话（计时服务内部状态，不持久化 lastTickAt）。 */
export interface ActiveSession {
  bookId: string;
  accumulatedMs: number;
  minutesCounted: number;
  xpAwarded: number;
  coinsAwarded: number;
  lastTickAt: number;
}

export function initialWallet(today: string): Wallet {
  return { id: WALLET_ID, coins: 0, xp: 0, todayDate: today, todayMinutes: 0 };
}

/** 按累计阅读分钟数计算应得金币：每 COINS_PER_MINUTES 分钟 +COINS_PER_BLOCK。 */
export function coinsForReadMinutes(minutes: number): number {
  return Math.floor(minutes / ECONOMY.COINS_PER_MINUTES) * ECONOMY.COINS_PER_BLOCK;
}

/** 连续打卡奖励：第 STREAK_FROM_DAY 天起每天 +STREAK_STEP，上限 STREAK_CAP。 */
export function streakBonus(streakDays: number): number {
  if (streakDays < ECONOMY.STREAK_FROM_DAY) return 0;
  return Math.min(
    (streakDays - ECONOMY.STREAK_FROM_DAY + 1) * ECONOMY.STREAK_STEP,
    ECONOMY.STREAK_CAP
  );
}

/**
 * 由累计毫秒推导当前应发奖励与整分钟数。
 * 发放策略：每次结算发放「推导值 - 已发放值」的增量，刷新不重发、不漏发。
 */
export function pendingAwards(accumulatedMs: number): { minutes: number; xp: number; coins: number } {
  const minutes = Math.floor(accumulatedMs / 60_000);
  return { minutes, xp: minutes * ECONOMY.XP_PER_MINUTE, coins: coinsForReadMinutes(minutes) };
}

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

/**
 * 计算连续打卡天数。
 * 今天已打卡 → 从今天往前数；今天未打卡但昨天已打卡 → 返回截至昨天的连续值
 * （当天尚未结束不清零，次日归零由本函数自然得出）；昨天也没打 → 0。
 */
export function computeStreak(checkedDates: readonly string[], today: string): number {
  const dates = new Set(checkedDates);
  let cursor = dates.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/** 跨天重置今日阅读统计（纯函数；同日返回原对象引用，便于调用方跳过写入）。 */
export function rolloverDaily(wallet: Wallet, today: string): Wallet {
  if (wallet.todayDate === today) return wallet;
  return { ...wallet, todayDate: today, todayMinutes: 0 };
}
