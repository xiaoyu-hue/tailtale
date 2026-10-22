/**
 * app 层编排：跨模块购买事务（扣币 → 使用零食 → 失败回滚）。
 *
 * 为什么在 app 层：模块间不直连（架构文档第 3.1 节依赖规则），
 * 金币在 gamification、零食效果在 pet，跨模块协调是 app 层的职责。
 *
 * 顺序说明：先扣币后使用。spendCoins 原子校验余额；若使用失败
 * （冷却中/精力不足/睡觉中——UI 已按同样规则禁用按钮，正常点不到，
 * 仅有并发竞态或 IO 异常时会发生），立即 refundCoins 回滚，用户无感。
 * 不采用「先用后扣」：那样在使用成功但扣款失败时会白送零食。
 */
import { refundCoins, spendCoins } from '../modules/gamification';
import { SNACKS, feedSnack } from '../modules/pet';
import type { Pet, PetRejectReason, SnackId } from '../modules/pet';

export type PurchaseRejectReason = 'insufficient' | PetRejectReason;

export type PurchaseResult =
  | { ok: true; pet: Pet; coinsLeft: number; affinityGained: number }
  | { ok: false; reason: PurchaseRejectReason };

/** 购买并使用一件零食/玩具（喂食/玩耍的统一入口；金币不足返回 insufficient）。 */
export async function buyAndUseSnack(snack: SnackId): Promise<PurchaseResult> {
  const price = SNACKS[snack].coins;
  let coinsLeft = 0;
  if (price > 0) {
    const spend = await spendCoins(price);
    if (!spend.ok) return { ok: false, reason: spend.reason };
    coinsLeft = spend.coins; // 扣款后余额（使用零食不再动币）
  }
  const result = await feedSnack(snack);
  if (!result.ok) {
    if (price > 0) await refundCoins(price); // 扣币成功但使用失败：回滚
    return { ok: false, reason: result.reason };
  }
  return { ok: true, pet: result.pet, coinsLeft, affinityGained: result.affinityGained };
}
