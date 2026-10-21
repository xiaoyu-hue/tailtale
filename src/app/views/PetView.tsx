import { useEffect, useRef, useState } from 'react';
import {
  CatStage,
  MOOD_LABELS,
  PET_ACTION_HINTS,
  PET_RULES,
  STAGE_LABELS,
  StatBars,
  acknowledgeBonds,
  currentStage,
  deriveMood,
  strokeCat,
  toggleSleep,
  usePet,
} from '../../modules/pet';

/** 下一阶段信息（已达完全体返回 null）。 */
function nextStageInfo(growth: number): { target: number; label: string } | null {
  if (growth < PET_RULES.STAGE_TEEN) return { target: PET_RULES.STAGE_TEEN, label: STAGE_LABELS.teen };
  if (growth < PET_RULES.STAGE_ADULT) return { target: PET_RULES.STAGE_ADULT, label: STAGE_LABELS.adult };
  if (growth < PET_RULES.GROWTH_CAP) return { target: PET_RULES.GROWTH_CAP, label: STAGE_LABELS.full };
  return null;
}

/** 宠物页：状态总览（形象/属性/成长）+ 免费互动（抚摸/睡觉）；购买入口在商店。 */
export default function PetView({ onOpenShop }: { onOpenShop: () => void }) {
  const pet = usePet();
  const toastTimerRef = useRef(0);
  const [toast, setToast] = useState<string | null>(null);
  const [bondCount, setBondCount] = useState(0);
  /** 本次挂载是否已展示过羁绊横幅（清零后可再次触发） */
  const bondsSeenRef = useRef(false);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  };

  // 羁绊时刻：挂载时发现未看计数 → 展示蹭屏幕横幅并消费（清零）；
  // 阅读中又产生新羁绊时会再次触发（计数先归零再变大）。
  useEffect(() => {
    if (!pet) return;
    if (pet.unseenBonds > 0) {
      if (!bondsSeenRef.current) {
        bondsSeenRef.current = true;
        setBondCount(pet.unseenBonds);
      }
      void acknowledgeBonds();
    } else {
      bondsSeenRef.current = false;
    }
  }, [pet]);

  if (!pet) {
    return (
      <>
        <h1 className="page-title">宠物</h1>
        <div className="card">
          <p className="muted">小猫还没醒过来，请稍后再试</p>
        </div>
      </>
    );
  }

  const mood = deriveMood(pet);
  const stage = currentStage(pet.growth);
  const next = nextStageInfo(pet.growth);
  const growthPercent = next ? Math.min(100, Math.round((pet.growth / next.target) * 100)) : 100;
  const strokesLeft = Math.max(0, PET_RULES.STROKE_DAILY_FREE - pet.strokesToday);

  const handleStroke = async () => {
    const result = await strokeCat();
    if (result.ok) {
      showToast(
        result.affinityGained > 0 ? `小猫眯起眼睛，好感 +${result.affinityGained}` : '今日好感度已满，小猫依然很喜欢你'
      );
    } else {
      showToast(PET_ACTION_HINTS[result.reason]);
    }
  };

  const handleSleep = async () => {
    const result = await toggleSleep();
    if (result.ok) {
      showToast(
        result.pet.sleeping
          ? '小猫睡着了，梦里都是你'
          : `小猫醒了${result.affinityGained > 0 ? `，好感 +${result.affinityGained}` : ''}`
      );
    } else {
      showToast(PET_ACTION_HINTS[result.reason]);
    }
  };

  return (
    <>
      <h1 className="page-title">宠物</h1>

      <section className="card pet-hero">
        <div className="pet-hero-head">
          <div className="pet-identity">
            <span className="pet-name">{pet.name}</span>
            <span className="pet-stage">{STAGE_LABELS[stage]}</span>
          </div>
          <div className="pet-hero-meta">
            <span className="pet-affinity">好感 {pet.affinity}</span>
            <span className="pet-mood-chip">{MOOD_LABELS[mood]}</span>
          </div>
        </div>

        <CatStage pet={pet} variant="lg" />

        {bondCount > 0 && <div className="bond-banner">小猫蹭了蹭屏幕 ×{bondCount}，很想你</div>}

        <div className="pet-growth">
          <div className="pet-growth-head">
            <span>
              成长 {pet.growth}
              {next ? ` / ${next.target}` : ''}
            </span>
            <span className="muted">
              {next ? `距${next.label}还差 ${Math.max(0, next.target - pet.growth)}` : '已长成完全体'}
            </span>
          </div>
          <div className="stat-bar-track">
            <div className="stat-bar-fill stat-bar-fill--growth" style={{ width: `${growthPercent}%` }} />
          </div>
        </div>
      </section>

      <section className="card">
        <StatBars pet={pet} />
      </section>

      <section className="card pet-actions">
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={pet.sleeping || strokesLeft <= 0}
            onClick={() => void handleStroke()}
          >
            抚摸{strokesLeft > 0 ? `（剩 ${strokesLeft} 次）` : '（今日已用完）'}
          </button>
          <button type="button" className="btn" onClick={() => void handleSleep()}>
            {pet.sleeping ? '唤醒' : '睡觉'}
          </button>
        </div>
        <div className="pet-shop-hint">
          <span className="muted">零食与玩具在商店购买，金币只能靠阅读赚取</span>
          <button type="button" className="btn btn-primary" onClick={onOpenShop}>
            去商店
          </button>
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
