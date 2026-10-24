import { createStore, useStore } from '../../platform/store';
import { loadSettledRecords, settleGame, type SettleResult } from './service';
import type { GameId, GameRecord, HostMode } from './model';

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
  loaded: boolean;
  hostMode: HostMode;
}

const store = createStore<GamesState>({
  records: {},
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
