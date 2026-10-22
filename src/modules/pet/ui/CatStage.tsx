import { useEffect, useRef } from 'react';
import { STAGE_LABELS, currentStage, deriveMood } from '../model';
import { MOOD_LABELS } from '../model';
import type { Pet, PetMood } from '../model';
import { CAT_SIZE, MOOD_TIMING, frameCanvas } from './pixelCat';

/** 变体 → 整数放大倍数（32×32 原图 × 倍数 = 画布逻辑尺寸，保证像素锐利）。 */
const SCALE = { lg: 5, sm: 3 } as const;

/** 羁绊蹭屏动画时长（毫秒）：猫朝右（屏幕外）蹭一下再回位。 */
const NUDGE_MS = 700;

export interface CatStageProps {
  pet: Pet;
  /** lg = 宠物页大图（160px），sm = 首页/商店缩略（96px） */
  variant?: keyof typeof SCALE;
}

/**
 * 像素猫舞台（零依赖 canvas 渲染器）：
 * - 二帧待机循环（睁眼 ↔ 眨眼+摇尾），节奏随情绪变化；
 * - 睡觉 = 静态帧 + 透明度呼吸 + HTML 的 Zzz 气泡；
 * - prefers-reduced-motion 时完全静止（只画一帧主帧）；
 * -  unseenBonds 增加时触发一次「蹭屏幕」位移（朝右 6 像素再回位）。
 * 所有位移均为整数像素，杜绝抗锯齿模糊；CSS 端 image-rendering: pixelated
 * 兜底任何非整数 CSS 缩放。
 */
export function CatStage({ pet, variant = 'lg' }: CatStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nudgeStartRef = useRef(Number.NEGATIVE_INFINITY);
  const lastBondsRef = useRef(pet.unseenBonds);

  const mood: PetMood = deriveMood(pet);
  const stage = currentStage(pet.growth);

  // 羁绊蹭屏：未看计数变大（0 → n）时触发一次
  useEffect(() => {
    const previous = lastBondsRef.current;
    lastBondsRef.current = pet.unseenBonds;
    if (pet.unseenBonds > previous) {
      nudgeStartRef.current = performance.now();
    }
  }, [pet.unseenBonds]);

  // 渲染循环（情绪/皮肤/尺寸变化时重建；nudge 经 ref 读取，不触发重建）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = SCALE[variant];
    canvas.width = CAT_SIZE * scale;
    canvas.height = CAT_SIZE * scale;

    const reduceMotion =
      document.documentElement.dataset.reduceMotion === 'on' || // 用户设置（设置页开关）
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches); // 系统偏好
    const timing = MOOD_TIMING[mood];
    let raf = 0;

    const render = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      let frame = 0;
      let alpha = 1;
      let offsetX = 0;
      let offsetY = timing.droop;

      if (mood === 'sleeping') {
        frame = 0; // 睡觉不眨眼不摇尾
        alpha = reduceMotion ? 0.85 : 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(now / 900));
      } else if (!reduceMotion) {
        const cycle = timing.frame1Ms + timing.frame2Ms;
        const phase = now % cycle;
        frame = phase < timing.frame1Ms ? 0 : 1;
        if (timing.bob > 0) {
          offsetY += Math.round(timing.bob * Math.sin((now / timing.bobPeriodMs) * Math.PI * 2));
        }
        const nudgeElapsed = now - nudgeStartRef.current;
        if (nudgeElapsed >= 0 && nudgeElapsed < NUDGE_MS) {
          offsetX = Math.round(6 * Math.sin((Math.PI * nudgeElapsed) / NUDGE_MS));
        }
      }

      ctx.globalAlpha = alpha;
      ctx.drawImage(
        frameCanvas(frame, pet.skin),
        0,
        0,
        CAT_SIZE,
        CAT_SIZE,
        offsetX * scale,
        offsetY * scale,
        CAT_SIZE * scale,
        CAT_SIZE * scale
      );
      ctx.globalAlpha = 1;

      if (!reduceMotion) raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [mood, pet.skin, variant]);

  const label = `${pet.name}，${STAGE_LABELS[stage]}，${MOOD_LABELS[mood]}`;
  return (
    <div className={`cat-stage cat-stage--${variant}`} role="img" aria-label={label}>
      <canvas ref={canvasRef} className="cat-canvas" aria-hidden="true" />
      {mood === 'sleeping' && (
        <div className="cat-zzz" aria-hidden="true">
          <span>Z</span>
          <span>z</span>
          <span>z</span>
        </div>
      )}
    </div>
  );
}
