/**
 * 像素猫资产与皮肤（渲染数据层，零依赖）。
 *
 * 资产来源：Desktop-Pixel-Pet（MIT License, Copyright (c) 2025 CanFlyhang），
 * 像素数据与调色板随仓库分发于 assets/pixel_cat.json，许可证全文见
 * assets/pixel_cat.LICENSE 与根目录 THIRD_PARTY_NOTICES.md。
 *
 * 皮肤 = 调色板置换（palette swap）：不动像素数据，只替换颜色键——
 * 资产本身的线条与造型保持不变，换色即换外观。
 * 注意：M3 只上四种零食（用户决策），皮肤仅定义数据，暂无解锁入口，
 * 解锁购买属 S2 装扮线（见 docs/书时-PRD.md §3.1.2）。
 */
import type { PetMood } from '../model';
import asset from './assets/pixel_cat.json';

/** 单帧像素网格：每格为调色板键名（'bg' 为透明，不绘制）。 */
export interface PixelCatFrame {
  name: string;
  pixels: string[][];
}

export interface PixelCatAsset {
  size: [number, number];
  /** 调色板：键名 → [r, g, b, a] */
  palette: Record<string, [number, number, number, number]>;
  frames: PixelCatFrame[];
}

/** 资产原始数据（JSON 由构建打包；TS 推断的元组/数组宽度不符，经 unknown 收敛到精确类型）。 */
export const CAT_ASSET = asset as unknown as PixelCatAsset;

/** 像素画布边长（32×32；所有变体按整数倍放大，保证像素锐利）。 */
export const CAT_SIZE = CAT_ASSET.size[0];

export type RGBA = [number, number, number, number];

/**
 * 皮肤定义：只覆盖要替换的调色板键，未列出的键沿用资产原色。
 * default 为空对象 = 资产原配色（灰虎斑 + 绿眼）。
 */
export type CatSkin = Record<string, RGBA>;

export const SKINS: Record<string, CatSkin> = {
  default: {},
  // 橘猫：暖橙主色 + 深橙阴影 + 奶白胸腹
  orange: {
    fur: [232, 152, 64, 255],
    dark: [176, 104, 36, 255],
    white: [255, 235, 205, 255],
    eye: [64, 138, 64, 255],
    nose: [255, 158, 148, 255],
    ear: [255, 178, 165, 255],
  },
  // 三花：白底黑橘斑（深色键作黑斑、white 键换橙 approximates 三花腹白斑）
  calico: {
    fur: [243, 238, 228, 255],
    dark: [62, 55, 52, 255],
    white: [236, 158, 74, 255],
    eye: [196, 138, 34, 255],
    nose: [255, 152, 142, 255],
    ear: [255, 172, 152, 255],
  },
  // 黑猫：暗毛 + 金眼
  black: {
    fur: [64, 60, 72, 255],
    dark: [36, 33, 42, 255],
    white: [158, 148, 172, 255],
    eye: [238, 192, 64, 255],
    nose: [198, 122, 122, 255],
    ear: [188, 132, 142, 255],
  },
};

/** 取皮肤调色板（未知名皮肤回落默认原色）。 */
export function skinPalette(skin: string): Record<string, RGBA> {
  const override = SKINS[skin];
  if (!override) return CAT_ASSET.palette;
  return { ...CAT_ASSET.palette, ...override };
}

/**
 * 情绪 → 动画节奏。
 * frame1 为主帧（睁眼 + 尾部位 A），frame2 为副帧（眨眼 + 尾部位 B），
 * 资产只有这两帧，全部待机动画都是二者的循环；
 * bob 为呼吸浮动幅度（像素），droop 为静态下垂偏移（没精神时下沉 1 像素）。
 */
export const MOOD_TIMING: Record<
  PetMood,
  { frame1Ms: number; frame2Ms: number; bob: number; bobPeriodMs: number; droop: number }
> = {
  // 睡觉：静态主帧（透明度呼吸在 CatStage 里做）
  sleeping: { frame1Ms: Infinity, frame2Ms: 0, bob: 0, bobPeriodMs: 0, droop: 0 },
  happy: { frame1Ms: 420, frame2Ms: 420, bob: 2, bobPeriodMs: 620, droop: 0 },
  content: { frame1Ms: 900, frame2Ms: 260, bob: 1, bobPeriodMs: 1100, droop: 0 },
  sad: { frame1Ms: 1400, frame2Ms: 400, bob: 0, bobPeriodMs: 0, droop: 1 },
  hungry: { frame1Ms: 300, frame2Ms: 300, bob: 0, bobPeriodMs: 0, droop: 0 },
  tired: { frame1Ms: 1800, frame2Ms: 600, bob: 0, bobPeriodMs: 0, droop: 1 },
};

/** 离屏帧缓存：键为 皮肤:帧序号。换肤/换帧只渲染一次，之后每帧一次 drawImage。 */
const frameCache = new Map<string, HTMLCanvasElement>();

/** 把单帧渲染为 32×32 离屏 canvas（透明背景像素跳过不绘）。 */
export function frameCanvas(frameIndex: number, skin: string): HTMLCanvasElement {
  const key = `${skin}:${frameIndex}`;
  const cached = frameCache.get(key);
  if (cached) return cached;

  const frame = CAT_ASSET.frames[frameIndex] ?? CAT_ASSET.frames[0];
  const palette = skinPalette(skin);
  const canvas = document.createElement('canvas');
  canvas.width = CAT_SIZE;
  canvas.height = CAT_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let y = 0; y < CAT_SIZE; y += 1) {
      const row = frame.pixels[y];
      for (let x = 0; x < CAT_SIZE; x += 1) {
        const color = palette[row[x]] ?? palette.bg;
        if (color[3] === 0) continue; // 透明像素不绘制
        ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  frameCache.set(key, canvas);
  return canvas;
}
