import { STORE_CHECKINS, STORE_READING_SESSION, STORE_WALLET, run } from '../../platform/db';
import { emit } from '../../platform/events';
import { todayKey } from '../../shared/dates';
import type { ActiveSession, Checkin, PersistedSession, Wallet } from './model';
import {
  ECONOMY,
  SESSION_ID,
  WALLET_ID,
  computeStreak,
  initialWallet,
  pendingAwards,
  rolloverDaily,
  streakBonus,
} from './model';

// ---- DB 访问（模块私有：外部只经 store 层） ----

export async function loadWallet(): Promise<Wallet> {
  const stored = await run<Wallet | undefined>(STORE_WALLET, 'readonly', (store) =>
    store.get(WALLET_ID)
  );
  return stored ?? initialWallet(todayKey());
}

export async function saveWallet(wallet: Wallet): Promise<void> {
  await run(STORE_WALLET, 'readwrite', (store) => store.put(wallet));
}

export async function loadTodayCheckin(today: string): Promise<Checkin | undefined> {
  return run<Checkin | undefined>(STORE_CHECKINS, 'readonly', (store) => store.get(today));
}

export async function loadCheckinDates(): Promise<string[]> {
  return run<string[]>(STORE_CHECKINS, 'readonly', (store) => store.getAllKeys());
}

async function saveCheckin(checkin: Checkin): Promise<void> {
  await run(STORE_CHECKINS, 'readwrite', (store) => store.put(checkin));
}

async function loadSession(): Promise<PersistedSession | undefined> {
  return run<PersistedSession | undefined>(STORE_READING_SESSION, 'readonly', (store) =>
    store.get(SESSION_ID)
  );
}

async function saveSession(session: PersistedSession): Promise<void> {
  await run(STORE_READING_SESSION, 'readwrite', (store) => store.put(session));
}

// ---- 阅读计时服务（单例，与 React 生命周期解耦） ----

const TICK_MS = 1_000;
/** 单次 tick 增量上限：设备睡眠唤醒后不一次性补记大段时间（PRD：页面可见才累计）。 */
const MAX_TICK_MS = 5_000;
/** 会话持久化兜底周期；正常停止与 pagehide 时也会立即持久化。 */
const PERSIST_EVERY_MS = 30_000;

let active: ActiveSession | null = null;
let timer: number | null = null;
/** 代际计数器：start/stop 各递增一次，令在途的异步续接失效（防 StrictMode 双挂载竞态）。 */
let generation = 0;
let lastPersistAt = 0;

/** 串行队列：钱包读写与会话持久化全部排队执行，避免并发结算竞态。 */
let tail: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const queued = tail.then(task);
  tail = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
}

function snapshot(session: ActiveSession): PersistedSession {
  return {
    id: SESSION_ID,
    bookId: session.bookId,
    accumulatedMs: session.accumulatedMs,
    minutesCounted: session.minutesCounted,
    xpAwarded: session.xpAwarded,
    coinsAwarded: session.coinsAwarded,
    bondsAwarded: session.bondsAwarded,
    updatedAt: Date.now(),
  };
}

/**
 * 开始阅读（打开一本书时调用）。
 * 同一本书的未结束会话会被恢复（刷新页面后继续计时）；换书则旧会话丢弃
 *（已发放奖励不受影响，丢弃的只是续计时能力）。
 */
export async function startReading(bookId: string): Promise<void> {
  const myGeneration = (generation += 1);
  let resumed: PersistedSession | undefined;
  try {
    resumed = await loadSession();
  } catch (error) {
    console.error('读取阅读会话失败', error);
  }
  if (myGeneration !== generation) return; // 已被更新的 start/stop 取代
  const base = resumed && resumed.bookId === bookId ? resumed : null;
  active = {
    bookId,
    accumulatedMs: base?.accumulatedMs ?? 0,
    minutesCounted: base?.minutesCounted ?? 0,
    xpAwarded: base?.xpAwarded ?? 0,
    coinsAwarded: base?.coinsAwarded ?? 0,
    bondsAwarded: base?.bondsAwarded ?? 0, // 旧版会话行无此字段，按 0（未触发过）
    lastTickAt: Date.now(),
  };
  lastPersistAt = Date.now();
  if (timer !== null) window.clearInterval(timer);
  timer = window.setInterval(() => void tick(myGeneration), TICK_MS);
  await settle(myGeneration); // 恢复的会话可能带有未发放的整分钟
}

/** 停止阅读（离开阅读页 = 合上书）：停表并持久化会话。 */
export function stopReading(): void {
  generation += 1; // 令在途 tick/settle 失效
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  const stopped = active;
  active = null;
  if (!stopped) return;
  void serialize(async () => {
    try {
      await saveSession(snapshot(stopped)); // 排队执行时读最新值（在途结算已先完成）
    } catch (error) {
      console.error('保存阅读会话失败', error);
    }
  });
}

function tick(myGeneration: number): void {
  if (myGeneration !== generation || !active) return;
  const now = Date.now();
  if (document.hidden) {
    // 浏览器后台不累计，但推进时间基点，避免恢复可见时补算隐藏时长
    active.lastTickAt = now;
    return;
  }
  const delta = Math.min(now - active.lastTickAt, MAX_TICK_MS);
  active.lastTickAt = now;
  if (delta <= 0) return;
  active.accumulatedMs += delta;
  void settle(myGeneration);
}

/**
 * 结算：按累计毫秒推导应发奖励，发放增量（XP 按整分钟、金币按 30 分钟块），
 * 同步今日阅读分钟数；每 PERSIST_EVERY_MS 兜底持久化会话。
 */
async function settle(myGeneration: number): Promise<void> {
  await serialize(async () => {
    if (myGeneration !== generation || !active) return;
    try {
      const { minutes, xp, coins } = pendingAwards(active.accumulatedMs);
      const deltaMinutes = minutes - active.minutesCounted;
      if (deltaMinutes > 0) {
        const wallet = rolloverDaily(await loadWallet(), todayKey());
        const updated: Wallet = {
          ...wallet,
          coins: wallet.coins + (coins - active.coinsAwarded),
          xp: wallet.xp + (xp - active.xpAwarded),
          todayMinutes: wallet.todayMinutes + deltaMinutes,
        };
        await saveWallet(updated);
        active.minutesCounted = minutes;
        active.xpAwarded = xp;
        active.coinsAwarded = coins;
        emit('wallet:changed', {
          coins: updated.coins,
          xp: updated.xp,
          todayMinutes: updated.todayMinutes,
        });
      }
      // 羁绊时刻：会话每跨满一个 30 分钟块广播一次（含刷新恢复的会话，
      // 与金币/XP 同口径；已触发计数落库，刷新不重触发）
      const bondsDue = Math.floor(active.accumulatedMs / (ECONOMY.BOND_BLOCK_MINUTES * 60_000));
      if (bondsDue > active.bondsAwarded) {
        active.bondsAwarded = bondsDue;
        emit('reading:bond_moment', {
          bookId: active.bookId,
          minutes: bondsDue * ECONOMY.BOND_BLOCK_MINUTES,
        });
        lastPersistAt = 0; // 羁绊计数立即落库（下方持久化条件随即满足）
      }
      if (Date.now() - lastPersistAt >= PERSIST_EVERY_MS) {
        await saveSession(snapshot(active));
        lastPersistAt = Date.now();
      }
    } catch (error) {
      console.error('阅读奖励结算失败', error); // 下个 tick 重试（已发放值未推进）
    }
  });
}

/** 刷新/误关页面时尽力持久化会话（异步写入在页面卸载时不保证完成，属尽力而为）。 */
function handlePageHide(): void {
  const session = active;
  if (!session) return;
  void serialize(async () => {
    try {
      await saveSession(snapshot(session));
    } catch (error) {
      console.error('页面隐藏时保存会话失败', error);
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', handlePageHide);
}

// ---- 打卡与完读奖励（store 层调用） ----

export type CheckinResult =
  | { ok: true; streak: number; bonus: number; total: number }
  | { ok: false; reason: 'already' | 'not-enough-minutes' | 'error' };

/** 每日打卡：当日阅读满 CHECKIN_MIN_MINUTES 分钟可领，基础 + 连续奖励。 */
export async function checkIn(today: string = todayKey()): Promise<CheckinResult> {
  try {
    return await serialize(async (): Promise<CheckinResult> => {
      const existing = await loadTodayCheckin(today);
      if (existing) return { ok: false, reason: 'already' as const };
      const wallet = rolloverDaily(await loadWallet(), today);
      if (wallet.todayMinutes < ECONOMY.CHECKIN_MIN_MINUTES) {
        return { ok: false, reason: 'not-enough-minutes' as const };
      }
      const dates = await loadCheckinDates();
      const streak = computeStreak(dates, today) + 1; // 今天尚未入库，+1 为本次打卡
      const bonus = streakBonus(streak);
      const checkin: Checkin = { id: today, date: today, streak, bonus, createdAt: Date.now() };
      await saveCheckin(checkin);
      const total = ECONOMY.CHECKIN_COINS + bonus;
      const updated: Wallet = { ...wallet, coins: wallet.coins + total };
      await saveWallet(updated);
      emit('wallet:changed', {
        coins: updated.coins,
        xp: updated.xp,
        todayMinutes: updated.todayMinutes,
      });
      emit('checkin:done', { date: today, streak, bonus });
      return { ok: true, streak, bonus, total };
    });
  } catch (error) {
    // 区分「时长不足」与「存储/持久化失败」：后者不应被误报成前者，否则会误导用户以为
    // 自己今天没读够，实则是本地数据库故障（隐私模式 / 存储满 / 浏览器异常）。
    console.error('打卡失败', error);
    return { ok: false, reason: 'error' };
  }
}

/** 读完一本书的一次性金币奖励（由 book:finished 事件触发）。 */
export async function awardBookFinish(): Promise<number> {
  try {
    return await serialize(async () => {
      const wallet = await loadWallet();
      const updated: Wallet = { ...wallet, coins: wallet.coins + ECONOMY.BOOK_FINISH_COINS };
      await saveWallet(updated);
      emit('wallet:changed', {
        coins: updated.coins,
        xp: updated.xp,
        todayMinutes: updated.todayMinutes,
      });
      return ECONOMY.BOOK_FINISH_COINS;
    });
  } catch (error) {
    console.error('完读奖励发放失败', error);
    return 0;
  }
}

// ---- 商店消费（S2：金币唯一出口） ----

export type SpendResult =
  | { ok: true; coins: number }
  | { ok: false; reason: 'insufficient' | 'io-error' };

/** 花费金币（商店购买入口）：余额不足不扣款；成功后广播 wallet:changed。 */
export async function spendCoins(amount: number): Promise<SpendResult> {
  try {
    return await serialize(async (): Promise<SpendResult> => {
      const wallet = rolloverDaily(await loadWallet(), todayKey());
      if (wallet.coins < amount) return { ok: false, reason: 'insufficient' as const };
      const updated: Wallet = { ...wallet, coins: wallet.coins - amount };
      await saveWallet(updated);
      emit('wallet:changed', {
        coins: updated.coins,
        xp: updated.xp,
        todayMinutes: updated.todayMinutes,
      });
      return { ok: true, coins: updated.coins };
    });
  } catch (error) {
    console.error('金币扣除失败', error);
    return { ok: false, reason: 'io-error' };
  }
}

/**
 * 退还金币：购买后「使用零食」失败的补偿回滚。
 * 正常流程不会走到（UI 已按规则禁用按钮）；仅在并发竞态或 IO 异常时兜底。
 */
export async function refundCoins(amount: number): Promise<void> {
  try {
    await serialize(async () => {
      const wallet = rolloverDaily(await loadWallet(), todayKey());
      const updated: Wallet = { ...wallet, coins: wallet.coins + amount };
      await saveWallet(updated);
      emit('wallet:changed', {
        coins: updated.coins,
        xp: updated.xp,
        todayMinutes: updated.todayMinutes,
      });
    });
  } catch (error) {
    console.error('金币退还失败', error);
  }
}
