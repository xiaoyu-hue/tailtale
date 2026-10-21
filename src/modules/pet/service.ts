import { STORE_PET, run } from '../../platform/db';
import { todayKey } from '../../shared/dates';
import type { Pet, PetActionResult } from './model';
import { PET_ID, initialPet, settleDecay } from './model';

// ---- DB 访问（模块私有：外部只经 store 层） ----

async function loadPet(): Promise<Pet | undefined> {
  return run<Pet | undefined>(STORE_PET, 'readonly', (store) => store.get(PET_ID));
}

async function savePet(pet: Pet): Promise<void> {
  await run(STORE_PET, 'readwrite', (store) => store.put(pet));
}

// ---- 串行队列：宠物读写全部排队执行，避免并发互动竞态 ----

let tail: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const queued = tail.then(task);
  tail = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
}

/**
 * 读-改-写入口：加载宠物 → 交给动作纯函数 → 落库 → 返回权威结果。
 * 动作内部自带衰减结算；拒绝时若状态有变（衰减/跨天重置）同样落库，
 * 保证内存与库收敛。DB 失败返回 reason='io-error'（pet 为读到的旧值或 null）。
 */
export async function mutatePet(
  action: (pet: Pet, now: number, today: string) => PetActionResult
): Promise<PetActionResult> {
  return serialize(async (): Promise<PetActionResult> => {
    const now = Date.now();
    const today = todayKey(new Date(now));
    let base: Pet;
    try {
      base = (await loadPet()) ?? initialPet(today, now);
    } catch (error) {
      console.error('读取宠物状态失败', error);
      return { ok: false, reason: 'io-error', pet: null };
    }
    const result = action(base, now, today);
    try {
      if (result.ok) {
        await savePet(result.pet);
      } else if (result.pet !== null && result.pet !== base) {
        await savePet(result.pet); // 拒绝但衰减/跨天重置已发生，需落库
      }
      return result;
    } catch (error) {
      console.error('保存宠物状态失败', error);
      return { ok: false, reason: 'io-error', pet: base };
    }
  });
}

/**
 * 启动加载：返回结算后的宠物（无行则创建初始宠物；有变化则已落库）。
 * 与 gamification 的 refreshGamification 并列由 App 启动时调用。
 */
export async function loadSettledPet(): Promise<Pet> {
  return serialize(async (): Promise<Pet> => {
    const now = Date.now();
    const today = todayKey(new Date(now));
    const stored = await loadPet();
    const base = stored ?? initialPet(today, now);
    const settled = settleDecay(base, now, today);
    if (!stored || settled !== base) await savePet(settled);
    return settled;
  });
}
