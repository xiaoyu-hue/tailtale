import { on } from '../../platform/events';
import { createStore, useStore } from '../../platform/store';
import {
  awardBookFinish,
  loadCheckinDates,
  loadTodayCheckin,
  loadWallet,
  saveWallet,
} from './service';
import { computeStreak, rolloverDaily, todayKey } from './model';

interface GamificationState {
  coins: number;
  xp: number;
  todayDate: string;
  todayMinutes: number;
  todayCheckin: { date: string; streak: number; bonus: number } | null;
  /** 连续打卡天数（今天未打卡则显示截至昨天的连续值） */
  streak: number;
  loaded: boolean;
}

const store = createStore<GamificationState>({
  coins: 0,
  xp: 0,
  todayDate: todayKey(),
  todayMinutes: 0,
  todayCheckin: null,
  streak: 0,
  loaded: false,
});

// ---- 跨模块事件订阅（模块加载即生效，不依赖任何视图挂载） ----

on('wallet:changed', ({ coins, xp, todayMinutes }) => {
  store.setState((s) => ({ ...s, coins, xp, todayMinutes }));
});

on('checkin:done', ({ date, streak, bonus }) => {
  store.setState((s) => ({ ...s, todayCheckin: { date, streak, bonus }, streak }));
});

/** 读完一本书：一次性金币奖励。会话内防重（跨会话由书籍 finished 状态天然阻止）。 */
const finishAwarded = new Set<string>();
on('book:finished', ({ bookId }) => {
  if (finishAwarded.has(bookId)) return;
  finishAwarded.add(bookId);
  void awardBookFinish();
});

// ---- 订阅 hooks（selector 只返回基本类型或 state 中已有引用） ----

export function useCoins(): number {
  return useStore(store, (s) => s.coins);
}

export function useXp(): number {
  return useStore(store, (s) => s.xp);
}

export function useTodayMinutes(): number {
  return useStore(store, (s) => s.todayMinutes);
}

export function useStreak(): number {
  return useStore(store, (s) => s.streak);
}

export function useTodayCheckin(): GamificationState['todayCheckin'] {
  return useStore(store, (s) => s.todayCheckin);
}

// ---- 状态动作 ----

/** 应用启动时加载游戏化状态（与 refreshBooks 并列由 App 调用）。 */
export async function refreshGamification(): Promise<void> {
  const today = todayKey();
  try {
    const [wallet, todayCheckin, dates] = await Promise.all([
      loadWallet(),
      loadTodayCheckin(today),
      loadCheckinDates(),
    ]);
    const rolled = rolloverDaily(wallet, today);
    if (rolled !== wallet) {
      try {
        await saveWallet(rolled); // 跨天：把重置后的今日统计落库
      } catch (error) {
        console.error('跨天重置保存失败', error);
      }
    }
    store.setState({
      coins: rolled.coins,
      xp: rolled.xp,
      todayDate: today,
      todayMinutes: rolled.todayMinutes,
      todayCheckin: todayCheckin
        ? { date: todayCheckin.date, streak: todayCheckin.streak, bonus: todayCheckin.bonus }
        : null,
      streak: computeStreak(dates, today),
      loaded: true,
    });
  } catch (error) {
    console.error('加载游戏化状态失败', error);
    store.setState((s) => ({ ...s, loaded: true })); // 失败不阻塞应用，按零值展示
  }
}
