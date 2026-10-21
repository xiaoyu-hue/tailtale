import { useState } from 'react';
import { SNACKS } from '../model';
import type { Pet, SnackId } from '../model';
import { useTicker } from '../../../shared/hooks/useTicker';

export interface SnackButtonsProps {
  pet: Pet;
  /** 当前金币余额（来自 gamification，由 app 层注入） */
  coins: number;
  /** 购买并喂食（app 层 commerce 事务）；异步期间按钮全部禁用 */
  onBuy: (snack: SnackId) => void | Promise<void>;
}

const SNACK_ORDER: SnackId[] = ['dried_fish', 'cat_rod', 'cat_tube', 'catnip'];

/** 效果描述（数值取自 SNACKS 表，不硬编码；energy 为负表示消耗）。 */
function effectText(snack: SnackId): string {
  const effect = SNACKS[snack];
  const parts: string[] = [];
  if (effect.hunger) parts.push(`饱食 +${effect.hunger}`);
  if (effect.mood) parts.push(`心情 +${effect.mood}`);
  if (effect.energy) parts.push(`精力 ${effect.energy > 0 ? '+' : ''}${effect.energy}`);
  parts.push(`好感 +${effect.affinity}`);
  return parts.join(' · ');
}

/** 冷却剩余毫秒 → m:ss；超过 1 小时用 h:mm:ss（避免 120 分钟式的误读）。 */
function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

interface SnackState {
  disabled: boolean;
  /** 禁用原因（按钮 title 提示；正常可购时为空） */
  hint: string;
  /** 冷却中时显示剩余时间，否则为空 */
  cooldownLeft: string;
}

/** 单件零食的可购状态：睡觉/精力不足/冷却中/余额不足/购买进行中均禁用。 */
function snackState(pet: Pet, snack: SnackId, coins: number, now: number, pending: boolean): SnackState {
  const effect = SNACKS[snack];
  if (pending) return { disabled: true, hint: '购买中…', cooldownLeft: '' };
  if (pet.sleeping) return { disabled: true, hint: '小猫睡着了，先叫醒它吧', cooldownLeft: '' };
  const energyDelta = effect.energy ?? 0;
  if (energyDelta < 0 && pet.energy + energyDelta < 0) {
    return { disabled: true, hint: '小猫没精力了，让它睡一觉吧', cooldownLeft: '' };
  }
  if (effect.cooldownMs !== undefined) {
    const left = effect.cooldownMs - (now - pet.lastPlayAt);
    if (left > 0) return { disabled: true, hint: '小猫玩累了，歇一会儿再来', cooldownLeft: formatRemaining(left) };
  }
  if (coins < effect.coins) return { disabled: true, hint: '金币不够，先去阅读赚金币吧', cooldownLeft: '' };
  return { disabled: false, hint: '', cooldownLeft: '' };
}

/**
 * 商店零食列表：四件商品（小鱼干/逗猫棒/猫条/猫薄荷），点击经 app 层
 * 编排「扣币 → 使用 → 失败回滚」。禁用规则与 pet 模型同源
 * （本组件只做展示层判断， authoritative 规则在 model.ts）。
 */
export function SnackButtons({ pet, coins, onBuy }: SnackButtonsProps) {
  const now = useTicker(1000);
  const [pending, setPending] = useState<SnackId | null>(null);

  const handleBuy = async (snack: SnackId) => {
    if (pending) return;
    setPending(snack);
    try {
      await onBuy(snack);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="snack-list">
      {SNACK_ORDER.map((snack) => {
        const effect = SNACKS[snack];
        const state = snackState(pet, snack, coins, now, pending !== null);
        return (
          <div className={`snack-row${state.disabled ? ' is-disabled' : ''}`} key={snack}>
            <div className="snack-info">
              <div className="snack-name">
                {effect.name}
                <span className="snack-price">{effect.coins} 币</span>
              </div>
              <div className="snack-effects">{effectText(snack)}</div>
            </div>
            <button
              type="button"
              className="btn btn-primary snack-buy"
              disabled={state.disabled}
              title={state.hint || `购买并喂食：${effect.name}`}
              onClick={() => void handleBuy(snack)}
            >
              {state.cooldownLeft ? `冷却 ${state.cooldownLeft}` : pending === snack ? '购买中' : '购买'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
