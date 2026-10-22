/**
 * gamification 模块领域模型：经济数值、纯函数、持久化类型。
 * 本文件不依赖 React / DOM / IndexedDB，可独立单测。
 * 数值权威来源：docs/书时-PRD.md §3.1.1，改动须先改 PRD。
 */
// 注意：import 路径带 .js 扩展名是 TypeScript NodeNext 规范写法
// （tsc --module NodeNext 编译单测时不报 TS2835），bundler 解析与 Vite 均兼容。
import { shiftDay } from '../../shared/dates.js';

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
  /**
   * 羁绊时刻块长（分钟）：阅读会话每累计跨满一个块广播一次 reading:bond_moment
   * （PRD §5.2 情感钩子「连续阅读 30 分钟，猫会蹭屏幕撒娇」）。
   * 语义上属宠物规则，但触发点在阅读会话累计值上，按模块边界置于此；
   * 宠物侧的好感增量见 pet 模块 PET_RULES.BOND_AFFINITY。
   */
  BOND_BLOCK_MINUTES: 30,
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
  /** 本会话已触发的羁绊时刻次数（防刷新后重复触发；旧行无此字段按 0） */
  bondsAwarded: number;
  updatedAt: number;
}

/** 内存中的活跃会话（计时服务内部状态，不持久化 lastTickAt）。 */
export interface ActiveSession {
  bookId: string;
  accumulatedMs: number;
  minutesCounted: number;
  xpAwarded: number;
  coinsAwarded: number;
  bondsAwarded: number;
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
