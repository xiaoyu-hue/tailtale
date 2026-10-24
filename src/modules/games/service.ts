import { STORE_GAME_RECORDS, run } from '../../platform/db';
import { todayKey } from '../../shared/dates';
import { awardCoins } from '../gamification';
import { chatOnce } from '../ai';
import {
  buildHostPrompt,
  initialGameRecord,
  localHostLine,
  rolloverGameRecord,
  settleGameReward,
  type GameId,
  type GameRecord,
  type GameSettlement,
  type HostContext,
  type HostEvent,
  type HostMode,
} from './model';

// ---- DB 访问（模块私有：外部只经 store 层） ----

async function loadRecord(gameId: GameId): Promise<GameRecord | undefined> {
  return run<GameRecord | undefined>(STORE_GAME_RECORDS, 'readonly', (store) => store.get(gameId));
}

async function loadAllRecords(): Promise<GameRecord[]> {
  return run<GameRecord[]>(STORE_GAME_RECORDS, 'readonly', (store) => store.getAll());
}

async function saveRecord(record: GameRecord): Promise<void> {
  await run(STORE_GAME_RECORDS, 'readwrite', (store) => store.put(record));
}

// ---- 串行队列：对局记录读写全部排队执行，避免并发结算竞态 ----

let tail: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const queued = tail.then(task);
  tail = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
}

// ---- 对局结算 ----

/** 结算结果（awarded=false 表示记录已落库但金币发放失败，由 UI 轻提示）。 */
export interface SettleResult {
  settlement: GameSettlement;
  awarded: boolean;
}

/**
 * 对局结算入口：读-改-写记录 → 一次发放算好的总额（钱包只记账，
 * 每日上限逻辑完全在 games 侧，不改造 gamification）。
 * awardCoins 失败返回 0，而加币后余额必 ≥ gained，故「gained>0 而返回 0」
 * 可判定为 IO 失败。
 */
export async function settleGame(gameId: GameId, won: boolean): Promise<SettleResult> {
  return serialize(async (): Promise<SettleResult> => {
    const now = Date.now();
    const today = todayKey(new Date(now));
    const stored = await loadRecord(gameId);
    const settlement = settleGameReward(
      stored ?? initialGameRecord(gameId, today, now),
      gameId,
      won,
      today,
      now
    );
    await saveRecord(settlement.record);
    if (settlement.gained > 0) {
      const balance = await awardCoins(settlement.gained);
      return { settlement, awarded: balance > 0 };
    }
    return { settlement, awarded: true };
  });
}

/**
 * 启动加载：返回全部对局记录（已做跨日重置；有变化的行落库）。
 * 与 refreshPet 并列由 App 启动时调用。
 */
export async function loadSettledRecords(): Promise<Partial<Record<GameId, GameRecord>>> {
  return serialize(async (): Promise<Partial<Record<GameId, GameRecord>>> => {
    const today = todayKey(new Date());
    const records: Partial<Record<GameId, GameRecord>> = {};
    for (const stored of await loadAllRecords()) {
      const rolled = rolloverGameRecord(stored, today);
      records[rolled.gameId] = rolled;
      if (rolled !== stored) await saveRecord(rolled);
    }
    return records;
  });
}

// ---- 主持人台词（AI / 本地双通道） ----

/** 台词结果（source 供 UI 标注来源与徽标）。 */
export interface HostLine {
  text: string;
  source: 'local' | 'ai';
}

/**
 * 取一句主持人台词：AI 模式走 chatOnce（ai 模块公开 API，单轮通用补全）；
 * 任何失败（未配置 / 断网 / 超时 / 报错）静默降级本地模板台词，
 * 不 toast 打断游戏。本地模式直接返回模板台词。
 */
export async function fetchHostLine(
  mode: HostMode,
  event: HostEvent,
  ctx: HostContext,
  signal?: AbortSignal
): Promise<HostLine> {
  if (mode === 'local') return { text: localHostLine(event, ctx), source: 'local' };
  try {
    const { system, user } = buildHostPrompt(event, ctx);
    const text = await chatOnce(system, user, signal);
    return { text, source: 'ai' };
  } catch (error) {
    console.warn('AI 主持人不可用，已降级为本地台词', error);
    return { text: localHostLine(event, ctx), source: 'local' };
  }
}
