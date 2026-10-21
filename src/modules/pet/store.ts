import { createStore, useStore } from '../../platform/store';
import { on } from '../../platform/events';
import { loadSettledPet, mutatePet } from './service';
import { acknowledgeBond, bondMoment, deriveMood, feed, sleep, stroke, wake } from './model';
import type { Pet, PetActionResult, PetMood, SnackId } from './model';

interface PetState {
  pet: Pet | null;
  loaded: boolean;
}

const store = createStore<PetState>({ pet: null, loaded: false });

// ---- 跨模块事件订阅（模块加载即生效，不依赖任何视图挂载） ----

/**
 * 羁绊时刻：阅读会话每跨满 30 分钟由 gamification 广播 reading:bond_moment
 * （PRD §5.2 情感钩子）。按架构文档 6.2 的判定——此事件有跨模块副作用
 * （pet 状态变更：好感 +BOND_AFFINITY、未看计数 +1 供猫视图播蹭屏幕），
 * 故走事件总线；pet 自身无消费者，不对外广播任何事件。
 * 未看计数由 UI 消费：猫视图/首页预览挂载时 acknowledgeBonds 清零并播放动画。
 */
on('reading:bond_moment', () => {
  void mutatePet(bondMoment).then(sync);
});

// ---- 订阅 hooks（selector 只返回基本类型或 state 中已有引用） ----

export function usePet(): Pet | null {
  return useStore(store, (s) => s.pet);
}

export function usePetLoaded(): boolean {
  return useStore(store, (s) => s.loaded);
}

/** 当前情绪（由属性推导；未加载返回 null）。deriveMood 返回字符串，引用稳定。 */
export function usePetMood(): PetMood | null {
  const pet = useStore(store, (s) => s.pet);
  return pet ? deriveMood(pet) : null;
}

// ---- 状态动作 ----

/** 动作后同步内存状态（DB 为权威源，result.pet 即结算后的最新状态）。 */
function sync(result: PetActionResult): PetActionResult {
  if (result.pet) store.setState({ pet: result.pet, loaded: true });
  return result;
}

/** 应用启动时加载宠物状态并结算离线衰减（与 refreshGamification 并列由 App 调用）。 */
export async function refreshPet(): Promise<void> {
  try {
    const pet = await loadSettledPet();
    store.setState({ pet, loaded: true });
  } catch (error) {
    console.error('加载宠物状态失败', error);
    store.setState((s) => ({ ...s, loaded: true })); // 失败不阻塞应用，宠物页按未加载展示
  }
}

/** 使用零食/玩具（喂食/玩耍；金币扣除由 S2 商店在 app 层编排）。 */
export function useSnack(snack: SnackId): Promise<PetActionResult> {
  return mutatePet((pet, now, today) => feed(pet, snack, now, today)).then(sync);
}

/** 免费抚摸（每日限次见 PET_RULES.STROKE_DAILY_FREE）。 */
export function strokeCat(): Promise<PetActionResult> {
  return mutatePet(stroke).then(sync);
}

/** 睡觉/唤醒切换（免费行动；按当前睡眠态二选一）。 */
export function toggleSleep(): Promise<PetActionResult> {
  return mutatePet((pet, now, today) => (pet.sleeping ? wake(pet, now, today) : sleep(pet, now, today))).then(sync);
}

/**
 * 消费羁绊时刻（猫被看到时调用）：清零未看计数。
 * 猫视图/首页预览挂载时由 UI 调用；计数为 0 时服务层不会写库。
 */
export function acknowledgeBonds(): Promise<void> {
  return mutatePet((pet, now, today) => ({
    ok: true as const,
    pet: acknowledgeBond(pet, now, today),
    affinityGained: 0,
  })).then(() => undefined);
}
