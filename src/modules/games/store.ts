import { createStore, useStore } from '../../platform/store';
import { fetchMatches, loadSettledRecords, recordDrawMatch, settleGame, type SettleResult } from './service';
import type { GameId, GameMatch, GameRecord, HostMode } from './model';

const HOST_MODE_KEY = 'tailtale:host-mode';

/** 主持人模式持久化（UI 偏好，存 localStorage；丢失默认 local=本地模板）。 */
function loadHostMode(): HostMode {
  try {
    return window.localStorage.getItem(HOST_MODE_KEY) === 'ai' ? 'ai' : 'local';
  } catch {
    return 'local';
  }
}

interface GamesState {
  records: Partial<Record<GameId, GameRecord>>;
  matches: GameMatch[];
  loaded: boolean;
  hostMode: HostMode;
}

const store = createStore<GamesState>({
  records: {},
  matches: [],
  loaded: false,
  hostMode: loadHostMode(),
});

// ---- 订阅 hooks ----

export function useGameRecord(gameId: GameId): GameRecord | null {
  return useStore(store, (s) => s.records[gameId] ?? null);
}

export function useGamesLoaded(): boolean {
  return useStore(store, (s) => s.loaded);
}

export function useHostMode(): HostMode {
  return useStore(store, (s) => s.hostMode);
}

export function useMatchHistory(): GameMatch[] {
  return useStore(store, (s) => s.matches);
}

// ---- 状态动作 ----

/** 切换主持人模式（立即持久化）。 */
export function setHostMode(mode: HostMode): void {
  store.setState((s) => ({ ...s, hostMode: mode }));
  try {
    window.localStorage.setItem(HOST_MODE_KEY, mode);
  } catch {
    /* 存储不可用时仅本次会话生效 */
  }
}

/** 应用启动时加载对局记录并结算跨日重置（与 refreshPet 并列由 App 调用）。 */
export async function refreshGames(): Promise<void> {
  try {
    const records = await loadSettledRecords();
    store.setState((s) => ({ ...s, records, loaded: true }));
  } catch (error) {
    console.error('加载对局记录失败', error);
    store.setState((s) => ({ ...s, loaded: true })); // 失败不阻塞应用，游戏页按未加载展示
  }
}

/** 对局结算：落库 + 发放金币 + 同步内存；返回结算结果供 UI 提示。 */
export function settleGameRound(gameId: GameId, won: boolean): Promise<SettleResult> {
  return settleGame(gameId, won).then((result) => {
    store.setState((s) => ({
      ...s,
      records: { ...s.records, [gameId]: result.settlement.record },
    }));
    return result;
  });
}

/** 刷新战绩流水（开「战绩」Sheet 时调用；结算后也会异步刷新）。 */
export async function refreshMatches(): Promise<void> {
  try {
    const matches = await fetchMatches();
    store.setState((s) => ({ ...s, matches }));
  } catch (error) {
    console.error('加载对局流水失败', error);
  }
}

/** 记录一局平局（不奖不罚；流水可见）。 */
export async function recordDraw(gameId: GameId): Promise<void> {
  try {
    await recordDrawMatch(gameId);
  } catch (error) {
    console.error('记录平局流水失败', error);
  }
  void refreshMatches();
}
