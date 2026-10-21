/**
 * pet 模块领域模型：宠物三属性、好感度/成长、睡觉态、纯函数、持久化类型。
 * 本文件不依赖 React / DOM / IndexedDB，也不 import 任何模块——
 * 当前时间（now）与日期键（today）一律由调用方注入，保证可独立编译单测
 * （tests/pet-model.test.mjs，编译方式见 package.json 的 test 脚本）。
 * 数值权威来源：docs/书时-PRD.md §3.1.2 / §5.2，改动须先改 PRD。
 */

/** 宠物单例行的 id（pet store 只有一行）。 */
export const PET_ID = 'pet';

/** 零食/玩具 id（PRD §3.1.2 商店四件商品；先上四种，皮肤类属 S2 装扮线）。 */
export type SnackId = 'dried_fish' | 'cat_rod' | 'cat_tube' | 'catnip';

/**
 * 成长阶段（按累计成长值划分）。
 * PRD §5.2 阈值为「少年猫 50 / 成年猫 150 / 完全体 400」——即达到阈值晋级，
 * 故实际分四档；50 以下档位 PRD 未命名，2026-10-21 用户定名「小猫」。
 */
export type PetStage = 'baby' | 'teen' | 'adult' | 'full';

/** 成长阶段显示名（UI 直接用，勿在别处硬编码中文档位名）。 */
export const STAGE_LABELS: Record<PetStage, string> = {
  baby: '小猫',
  teen: '少年猫',
  adult: '成年猫',
  full: '完全体',
};

/** 宠物情绪（UI 选表情/动画用；由属性推导，不持久化）。 */
export type PetMood = 'sleeping' | 'hungry' | 'tired' | 'sad' | 'happy' | 'content';

/** 情绪显示名（UI 直接用，勿在别处硬编码）。 */
export const MOOD_LABELS: Record<PetMood, string> = {
  sleeping: '睡着啦',
  hungry: '饿坏了',
  tired: '没精力',
  sad: '不开心',
  happy: '很开心',
  content: '心情不错',
};

/** 动作被拒绝的原因（UI 据此提示；io-error 为 service 层专用，DB 读写失败时返回）。 */
export type PetRejectReason =
  | 'sleeping'
  | 'already-sleeping'
  | 'awake'
  | 'tired'
  | 'cooldown'
  | 'strokes-used'
  | 'io-error';

/**
 * 动作结果。pet 恒为「结算后的权威状态」：成功为动作后状态，
 * 失败为衰减结算后状态（供 store 同步内存）；仅 io-error 可能为 null
 * （连库都没读上，内存保持原状）。
 */
export type PetActionResult =
  | { ok: true; pet: Pet; affinityGained: number }
  | { ok: false; reason: PetRejectReason; pet: Pet | null };

/** 动作被拒绝时的提示文案（UI 直接用；io-error 为 service 层 DB 失败兜底）。 */
export const PET_ACTION_HINTS: Record<PetRejectReason, string> = {
  sleeping: '小猫睡着了，先叫醒它吧',
  'already-sleeping': '小猫已经在睡了',
  awake: '小猫已经醒了',
  tired: '小猫没精力了，让它睡一觉吧',
  cooldown: '小猫玩累了，歇一会儿再来',
  'strokes-used': '今天的免费抚摸用完啦，明天再来',
  'io-error': '存储读写失败，请稍后再试',
};

/** 零食/玩具效果表（PRD §3.1.2；coins 为商店售价，S2 商店与 app 层编排消费）。 */
export interface SnackEffect {
  name: string;
  /** 售价（金币） */
  coins: number;
  /** 饱食度增量 */
  hunger?: number;
  /** 心情增量 */
  mood?: number;
  /** 精力增量（逗猫棒为负：玩耍消耗精力） */
  energy?: number;
  /** 好感度增量（受每日上限约束） */
  affinity: number;
  /** 同类动作冷却毫秒数（逗猫棒 4 小时；PRD §3.1.2） */
  cooldownMs?: number;
}

export const SNACKS: Record<SnackId, SnackEffect> = {
  dried_fish: { name: '小鱼干', coins: 20, hunger: 30, affinity: 2 },
  cat_rod: {
    name: '逗猫棒',
    coins: 30,
    mood: 40,
    energy: -15,
    affinity: 5,
    cooldownMs: 4 * 60 * 60 * 1000,
  },
  cat_tube: { name: '猫条', coins: 50, hunger: 50, affinity: 8 },
  catnip: { name: '猫薄荷', coins: 80, hunger: 20, mood: 20, energy: 20, affinity: 15 },
};

/** 宠物数值规则（PRD §5.2 + 已决策补充；三属性衰减速度为「天」级）。 */
export const PET_RULES = {
  /** 三属性上限（均为 0-100） */
  STAT_MAX: 100,
  /** 饱食度每日衰减 */
  HUNGER_DECAY_PER_DAY: 30,
  /** 心情每日衰减 */
  MOOD_DECAY_PER_DAY: 20,
  /** 精力每日衰减 */
  ENERGY_DECAY_PER_DAY: 20,
  /**
   * 离线衰减结算上限：一次最多结算 7 天。
   * 借鉴 Tamagochi Cozy 模式，防「设备长期关机 / 改系统时钟」造成属性断崖；
   * 但不采用 Cozy 的 12 小时——阅读应用可能连续数日不打开，衰减全豁免会让
   * 「猫会饿、会想念」失去意义。7 天封顶兼顾防断崖与习惯钩子。
   */
  MAX_DECAY_DAYS: 7,
  /** 睡觉时饱食度衰减减半（睡得沉饿得慢） */
  SLEEP_HUNGER_FACTOR: 0.5,
  /** 睡觉时精力回复：每小时 +SLEEP_ENERGY_PER_HOUR，单次睡觉最多 +SLEEP_ENERGY_CAP */
  SLEEP_ENERGY_PER_HOUR: 10,
  SLEEP_ENERGY_CAP: 40,
  /** 睡醒好感 +WAKE_AFFINITY（计入每日上限；防睡觉刷好感） */
  WAKE_AFFINITY: 1,
  /** 好感度每日获取上限（PRD §3.1.3 防刷） */
  AFFINITY_DAILY_CAP: 10,
  /** 饱食度 ≤ 该值进入「想念」：每结算完一整天好感 -MISSING_AFFINITY_PER_DAY（PRD §5.2 无死亡机制） */
  MISSING_HUNGER: 20,
  MISSING_AFFINITY_PER_DAY: 2,
  /** 成长阶段阈值（累计成长值，只增不减；PRD §5.2） */
  STAGE_TEEN: 50,
  STAGE_ADULT: 150,
  /** 成长值硬上限（与「完全体 400」对齐，防数值无限膨胀） */
  GROWTH_CAP: 400,
  /** 免费抚摸每日次数（2026-10-21 用户决策：2 次；PRD 旧值 §3.1.2 记 3 次、§5.2 记 1 次，两处均已按此统一） */
  STROKE_DAILY_FREE: 2,
  /** 免费抚摸的心情增量（PRD 未规定，体验补充小值，后续可调） */
  STROKE_MOOD: 5,
  /** 玩耍（逗猫棒）所需最低精力：低于此值玩不动，需睡觉回复（与 deriveMood 的 tired 同源） */
  PLAY_ENERGY_COST: 15,
  /** 情绪阈值：心情 ≤ MOOD_LOW 显示难过，≥ MOOD_HIGH 显示开心 */
  MOOD_LOW: 30,
  MOOD_HIGH: 80,
  /** 羁绊时刻（连续阅读 30 分钟）好感增量（PRD 未规定数值，体验补充小值，计入每日上限） */
  BOND_AFFINITY: 5,
} as const;

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

/** 宠物持久化行：单例（id 固定 PET_ID）。 */
export interface Pet {
  id: typeof PET_ID;
  /** 名字（v1 默认「小咪」，重命名功能后续补） */
  name: string;
  /** 饱食度 0-100 */
  hunger: number;
  /** 心情 0-100 */
  mood: number;
  /** 精力 0-100 */
  energy: number;
  /** 当前好感度（被冷落会下降，最低 0） */
  affinity: number;
  /** 累计成长值（只增不减；决定成长阶段与外观） */
  growth: number;
  /** 是否睡觉中（睡觉中拒绝喂食/玩耍/抚摸，防挂机刷属性） */
  sleeping: boolean;
  /** 本次睡觉开始时间戳（未睡为 0；睡醒时按睡眠时长算精力回复） */
  sleepStartedAt: number;
  /** 上次衰减结算时间戳（离线衰减按时间戳差分） */
  lastDecayAt: number;
  /** 上次玩逗猫棒的时间戳（冷却判断） */
  lastPlayAt: number;
  /** 抚摸计数所属日期键（本地时区 YYYY-MM-DD） */
  strokeDate: string;
  /** 今日已免费抚摸次数 */
  strokesToday: number;
  /** 好感度计数所属日期键 */
  affinityDate: string;
  /** 今日已获得好感度（防刷上限按此判断） */
  affinityToday: number;
  /** 皮肤 id（v1 固定 default；S2 商店解锁橘猫/三花/黑猫外观） */
  skin: string;
  /** 未被看到的羁绊时刻次数（连续阅读 30 分钟 +1；猫视图挂载时消费并播放蹭屏幕动画） */
  unseenBonds: number;
}

/** 初始宠物（首次进入应用时创建；三属性从 80 起步，留出成长空间）。 */
export function initialPet(today: string, now: number): Pet {
  return {
    id: PET_ID,
    name: '小咪',
    hunger: 80,
    mood: 80,
    energy: 80,
    affinity: 0,
    growth: 0,
    sleeping: false,
    sleepStartedAt: 0,
    lastDecayAt: now,
    lastPlayAt: 0,
    strokeDate: today,
    strokesToday: 0,
    affinityDate: today,
    affinityToday: 0,
    skin: 'default',
    unseenBonds: 0,
  };
}

function clampStat(value: number): number {
  return Math.min(PET_RULES.STAT_MAX, Math.max(0, value));
}

/** 每日计数跨天重置（纯函数；无变化返回原引用，便于调用方跳过写入）。 */
function rolloverCounters(pet: Pet, today: string): Pet {
  const needStroke = pet.strokeDate !== today;
  const needAffinity = pet.affinityDate !== today;
  if (!needStroke && !needAffinity) return pet;
  return {
    ...pet,
    ...(needStroke ? { strokeDate: today, strokesToday: 0 } : null),
    ...(needAffinity ? { affinityDate: today, affinityToday: 0 } : null),
  };
}

/**
 * 衰减结算（纯函数；应用启动与每次互动前调用）。
 * 规则：
 * - 离线时长按 lastDecayAt 到 now 的差分计算，封顶 MAX_DECAY_DAYS 天；
 * - 按天推进衰减：饱食/心情/精力各按日速折算；睡觉时饱食衰减减半、
 *   心情与精力不衰减（精力的睡觉回复在睡醒时一次性发放，见 wake）；
 * - 每结算完一整天，若当日结算后饱食度 ≤ MISSING_HUNGER，好感度
 *   -MISSING_AFFINITY_PER_DAY（「表示想念」，最低 0；进行中的当天不罚）；
 * - 抚摸/好感度每日计数按日期键跨天重置；
 * - 无事发生时返回原引用（调用方据此跳过写库）。
 */
export function settleDecay(pet: Pet, now: number, today: string): Pet {
  const rolled = rolloverCounters(pet, today);
  const elapsed = Math.min(
    Math.max(now - rolled.lastDecayAt, 0),
    PET_RULES.MAX_DECAY_DAYS * DAY_MS
  );
  if (elapsed <= 0) return rolled;

  let { hunger, mood, energy, affinity } = rolled;
  let remaining = elapsed;
  while (remaining > 0) {
    const step = Math.min(remaining, DAY_MS);
    const fraction = step / DAY_MS;
    hunger = clampStat(
      hunger -
        PET_RULES.HUNGER_DECAY_PER_DAY * fraction * (rolled.sleeping ? PET_RULES.SLEEP_HUNGER_FACTOR : 1)
    );
    if (!rolled.sleeping) {
      mood = clampStat(mood - PET_RULES.MOOD_DECAY_PER_DAY * fraction);
      energy = clampStat(energy - PET_RULES.ENERGY_DECAY_PER_DAY * fraction);
    }
    // 想念惩罚按「完整的过去一天」结算；不足一整天（含进行中的当天）不罚
    if (step >= DAY_MS && hunger <= PET_RULES.MISSING_HUNGER) {
      affinity = Math.max(0, affinity - PET_RULES.MISSING_AFFINITY_PER_DAY);
    }
    remaining -= step;
  }
  return { ...rolled, hunger, mood, energy, affinity, lastDecayAt: now };
}

/**
 * 好感度发放（纯函数）：受每日上限约束，实际发放值同时累计进成长值。
 * 返回发放结果与需写回的字段（gained 为实际发放值，供 UI 提示）。
 */
function grantAffinity(
  pet: Pet,
  amount: number,
  today: string
): { affinity: number; growth: number; affinityToday: number; affinityDate: string; gained: number } {
  const base = pet.affinityDate === today ? pet : { ...pet, affinityDate: today, affinityToday: 0 };
  const room = Math.max(0, PET_RULES.AFFINITY_DAILY_CAP - base.affinityToday);
  const gained = Math.max(0, Math.min(amount, room));
  return {
    affinity: base.affinity + gained,
    growth: Math.min(PET_RULES.GROWTH_CAP, base.growth + gained),
    affinityToday: base.affinityToday + gained,
    affinityDate: today,
    gained,
  };
}

/** 成长阶段（按累计成长值；阈值见 PET_RULES，与 PRD「少年猫 50/成年猫 150/完全体 400」对齐）。 */
export function currentStage(growth: number): PetStage {
  if (growth >= PET_RULES.GROWTH_CAP) return 'full';
  if (growth >= PET_RULES.STAGE_ADULT) return 'adult';
  if (growth >= PET_RULES.STAGE_TEEN) return 'teen';
  return 'baby';
}

/** 由当前属性推导情绪（UI 选表情/动画；睡觉优先，其余按优先级取最紧迫的需求）。 */
export function deriveMood(pet: Pet): PetMood {
  if (pet.sleeping) return 'sleeping';
  if (pet.hunger <= PET_RULES.MISSING_HUNGER) return 'hungry';
  if (pet.energy <= PET_RULES.PLAY_ENERGY_COST) return 'tired';
  if (pet.mood <= PET_RULES.MOOD_LOW) return 'sad';
  if (pet.mood >= PET_RULES.MOOD_HIGH) return 'happy';
  return 'content';
}

/**
 * 使用零食/玩具（喂食/玩耍统一入口；金币扣除在 S2 由 app 层编排，本函数只管效果）。
 * 先结算衰减再生效；睡觉中不可用；精力消耗为负的项（逗猫棒）有精力门槛，
 * 带冷却的项（逗猫棒 4 小时）在冷却内不可用。
 */
export function feed(pet: Pet, snack: SnackId, now: number, today: string): PetActionResult {
  const settled = settleDecay(pet, now, today);
  if (settled.sleeping) return { ok: false, reason: 'sleeping', pet: settled };
  const effect = SNACKS[snack];
  const energyDelta = effect.energy ?? 0;
  if (energyDelta < 0 && settled.energy + energyDelta < 0) {
    return { ok: false, reason: 'tired', pet: settled };
  }
  if (effect.cooldownMs !== undefined && now - settled.lastPlayAt < effect.cooldownMs) {
    return { ok: false, reason: 'cooldown', pet: settled };
  }
  const granted = grantAffinity(settled, effect.affinity, today);
  const next: Pet = {
    ...settled,
    hunger: clampStat(settled.hunger + (effect.hunger ?? 0)),
    mood: clampStat(settled.mood + (effect.mood ?? 0)),
    energy: clampStat(settled.energy + energyDelta),
    affinity: granted.affinity,
    growth: granted.growth,
    affinityToday: granted.affinityToday,
    affinityDate: granted.affinityDate,
    ...(effect.cooldownMs !== undefined ? { lastPlayAt: now } : null),
  };
  return { ok: true, pet: next, affinityGained: granted.gained };
}

/**
 * 免费抚摸（每日 STROKE_DAILY_FREE 次；好感 +1 计入每日上限，
 * 心情 +STROKE_MOOD 为体验补充值）。睡觉中不可用。
 */
export function stroke(pet: Pet, now: number, today: string): PetActionResult {
  const settled = settleDecay(pet, now, today);
  if (settled.sleeping) return { ok: false, reason: 'sleeping', pet: settled };
  if (settled.strokesToday >= PET_RULES.STROKE_DAILY_FREE) {
    return { ok: false, reason: 'strokes-used', pet: settled };
  }
  const granted = grantAffinity(settled, 1, today);
  const next: Pet = {
    ...settled,
    mood: clampStat(settled.mood + PET_RULES.STROKE_MOOD),
    strokesToday: settled.strokesToday + 1,
    strokeDate: today,
    affinity: granted.affinity,
    growth: granted.growth,
    affinityToday: granted.affinityToday,
    affinityDate: granted.affinityDate,
  };
  return { ok: true, pet: next, affinityGained: granted.gained };
}

/**
 * 睡觉（免费行动）：先结算衰减再入睡。
 * 睡觉期间饱食衰减减半、心情不衰减、精力不衰减（睡醒一次性回复）。
 * 已在睡觉中则拒绝。
 */
export function sleep(pet: Pet, now: number, today: string): PetActionResult {
  const settled = settleDecay(pet, now, today);
  if (settled.sleeping) return { ok: false, reason: 'already-sleeping', pet: settled };
  const next: Pet = { ...settled, sleeping: true, sleepStartedAt: now };
  return { ok: true, pet: next, affinityGained: 0 };
}

/**
 * 羁绊时刻（连续阅读 30 分钟，由 reading:bond_moment 事件触发）：
 * 好感 +BOND_AFFINITY（计入每日上限），未看计数 +1（供猫视图播放蹭屏幕动画）。
 */
export function bondMoment(pet: Pet, now: number, today: string): PetActionResult {
  const settled = settleDecay(pet, now, today);
  const granted = grantAffinity(settled, PET_RULES.BOND_AFFINITY, today);
  const next: Pet = {
    ...settled,
    affinity: granted.affinity,
    growth: granted.growth,
    affinityToday: granted.affinityToday,
    affinityDate: granted.affinityDate,
    unseenBonds: settled.unseenBonds + 1,
  };
  return { ok: true, pet: next, affinityGained: granted.gained };
}

/** 消费羁绊时刻（猫被看到时调用）：清零未看计数（无变化返回原引用）。 */
export function acknowledgeBond(pet: Pet, now: number, today: string): Pet {
  const settled = settleDecay(pet, now, today);
  return settled.unseenBonds === 0 ? settled : { ...settled, unseenBonds: 0 };
}

/**
 * 睡醒：结算衰减（睡觉态口径）后，按本次睡眠时长回复精力
 * （每小时 +SLEEP_ENERGY_PER_HOUR，单次最多 +SLEEP_ENERGY_CAP），
 * 好感 +WAKE_AFFINITY（计入每日上限，防睡觉刷好感）。未睡则拒绝。
 */
export function wake(pet: Pet, now: number, today: string): PetActionResult {
  const settled = settleDecay(pet, now, today);
  if (!settled.sleeping) return { ok: false, reason: 'awake', pet: settled };
  const hours = Math.max(0, (now - settled.sleepStartedAt) / HOUR_MS);
  const energyGain = Math.min(
    PET_RULES.SLEEP_ENERGY_CAP,
    Math.round(hours * PET_RULES.SLEEP_ENERGY_PER_HOUR)
  );
  const granted = grantAffinity(settled, PET_RULES.WAKE_AFFINITY, today);
  const next: Pet = {
    ...settled,
    sleeping: false,
    sleepStartedAt: 0,
    energy: clampStat(settled.energy + energyGain),
    affinity: granted.affinity,
    growth: granted.growth,
    affinityToday: granted.affinityToday,
    affinityDate: granted.affinityDate,
  };
  return { ok: true, pet: next, affinityGained: granted.gained };
}
