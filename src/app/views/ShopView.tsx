import { useRef, useState } from 'react';
import { useCoins } from '../../modules/gamification';
import {
  CatStage,
  MOOD_LABELS,
  PET_ACTION_HINTS,
  SNACKS,
  STAGE_LABELS,
  SnackButtons,
  currentStage,
  deriveMood,
  usePet,
} from '../../modules/pet';
import type { SnackId } from '../../modules/pet';
import { buyAndUseSnack } from '../commerce';

/** 商店页：金币余额 + 四件零食（购买即喂食）+ 装扮线规划。购买事务在 app 层编排。 */
export default function ShopView() {
  const pet = usePet();
  const coins = useCoins();
  const toastTimerRef = useRef(0);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  };

  const handleBuy = async (snack: SnackId) => {
    const result = await buyAndUseSnack(snack);
    if (result.ok) {
      showToast(`${SNACKS[snack].name}喂食成功 · 好感 +${result.affinityGained} · 剩余 ${result.coinsLeft} 币`);
    } else if (result.reason === 'insufficient') {
      showToast('金币不够，先去阅读赚金币吧');
    } else {
      showToast(PET_ACTION_HINTS[result.reason]);
    }
  };

  return (
    <>
      <h1 className="page-title">商店</h1>

      <section className="card shop-balance">
        <div className="shop-balance-main">
          <div className="muted">金币余额</div>
          <div className="shop-coins">{coins}</div>
        </div>
        <p className="muted shop-balance-note">金币只能靠阅读赚取，不可购买</p>
      </section>

      {pet && (
        <section className="card shop-pet">
          <CatStage pet={pet} variant="sm" />
          <div className="shop-pet-info">
            <div className="pet-name">{pet.name}</div>
            <div className="muted">
              {MOOD_LABELS[deriveMood(pet)]} · {STAGE_LABELS[currentStage(pet.growth)]}
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">零食与玩具</h2>
        {pet ? (
          <SnackButtons pet={pet} coins={coins} onBuy={handleBuy} />
        ) : (
          <p className="muted">小猫还没醒，稍后再来</p>
        )}
      </section>

      <section className="card shop-planned">
        <h2 className="section-title">装扮线（规划中）</h2>
        <ul className="placeholder-list">
          <li>皮肤：橘猫 200 / 三花 400 / 黑猫 600 币</li>
          <li>阅读主题皮肤 300 币</li>
          <li>日收入与日常消耗大致持平，基础皮肤约两周可攒出</li>
        </ul>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
