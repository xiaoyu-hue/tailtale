/**
 * games 模块领域模型：游戏目录、金币经济、对局记录、主持人台词。
 * 纯函数、零依赖，不接触 React / DOM / IndexedDB；当前时间（now）与
 * 日期键（today）一律由调用方注入，保证可独立编译单测
 * （tests/games-model.test.mjs）。
 * 数值权威来源：docs/书时-PRD.md §3.1.1，改动须先改 PRD。
 */

/** 游戏 id（目录制；后续批次逐个接入，store / DB 结构不变）。 */
export type GameId =
  | 'guess_number'
  | 'guess_idiom'
  | 'guess_riddle'
  | 'brain_teaser'
  | 'gomoku'
  | 'tictactoe';

/** 游戏显示名（UI 直接用，勿在别处硬编码中文名）。 */
export const GAME_LABELS: Record<GameId, string> = {
  guess_number: '猜数字',
  guess_idiom: '猜成语',
  guess_riddle: '猜歇后语',
  brain_teaser: '脑筋急转弯',
  gomoku: '五子棋',
  tictactoe: '井字棋',
};

/** 经济规则（PRD §3.1.1 游戏奖励行；上限为防刷设计）。 */
export interface GameEconomyRule {
  /** 胜局奖励（金币） */
  winCoins: number;
  /** 每日发放上限（金币） */
  dailyCap: number;
}

export const GAME_ECONOMY: Record<GameId, GameEconomyRule> = {
  guess_number: { winCoins: 1, dailyCap: 5 },
  guess_idiom: { winCoins: 2, dailyCap: 10 },
  guess_riddle: { winCoins: 2, dailyCap: 10 },
  brain_teaser: { winCoins: 2, dailyCap: 10 },
  gomoku: { winCoins: 3, dailyCap: 9 },
  tictactoe: { winCoins: 2, dailyCap: 6 },
};

/** 任意游戏首玩一次性奖励（不占每日上限）。 */
export const FIRST_PLAY_COINS = 3;

/** 对局记录行（db 'tailtale' 的 game_records store，keyPath 为 gameId）。 */
export interface GameRecord {
  gameId: GameId;
  /** 今日金币计数所属日期键（本地时区 YYYY-MM-DD） */
  earnedDate: string;
  /** 今日已实发金币（受每日上限截断后的值） */
  earnedToday: number;
  /** 当前连胜（判负清零） */
  streak: number;
  /** 历史最佳连胜（不清零） */
  bestStreak: number;
  /** 总局数 */
  plays: number;
  /** 首玩奖励是否已领（跨日不清除） */
  firstPlayClaimed: boolean;
  /** 最近游玩时间戳 */
  lastPlayedAt: number;
}

/** 初始对局记录（首次游玩该游戏时创建）。 */
export function initialGameRecord(gameId: GameId, today: string, now: number): GameRecord {
  return {
    gameId,
    earnedDate: today,
    earnedToday: 0,
    streak: 0,
    bestStreak: 0,
    plays: 0,
    firstPlayClaimed: false,
    lastPlayedAt: now,
  };
}

/** 每日计数跨天重置（纯函数；无变化返回原引用，便于调用方跳过写入）。 */
export function rolloverGameRecord(record: GameRecord, today: string): GameRecord {
  if (record.earnedDate === today) return record;
  return { ...record, earnedDate: today, earnedToday: 0 };
}

/** 对局结算结果（record 需写回；金额字段供 UI 提示与 service 发放）。 */
export interface GameSettlement {
  /** 结算后的记录（需写回） */
  record: GameRecord;
  /** 本局实发金币总额（含首玩奖励） */
  gained: number;
  /** 本局胜局奖励（可能被上限截断） */
  winCoins: number;
  /** 本局首玩奖励（0 或 FIRST_PLAY_COINS） */
  firstPlayBonus: number;
  /** 胜局奖励是否被今日上限截断 */
  capped: boolean;
}

/**
 * 对局结算（纯函数）：先跨日重置，再按经济规则计算应发金币。
 * 规则（PRD §3.1.1）：
 * - 胜局奖励受每日上限约束（room = cap - earnedToday），截断时标记 capped；
 * - 首玩奖励一次性、不占也不消耗 earnedToday（无刷取空间），与胜局奖励叠加；
 * - 判负：连胜清零、最佳连胜保留；首玩仍发（安慰奖）；
 * - 任何结果都推进 plays / lastPlayedAt。
 */
export function settleGameReward(
  record: GameRecord,
  gameId: GameId,
  won: boolean,
  today: string,
  now: number
): GameSettlement {
  const base = rolloverGameRecord(record, today);
  const rule = GAME_ECONOMY[gameId];
  const room = Math.max(0, rule.dailyCap - base.earnedToday);
  const winCoins = won ? Math.min(rule.winCoins, room) : 0;
  const capped = won && winCoins < rule.winCoins;
  const firstPlayBonus = base.firstPlayClaimed ? 0 : FIRST_PLAY_COINS;
  return {
    record: {
      ...base,
      earnedToday: base.earnedToday + winCoins,
      streak: won ? base.streak + 1 : 0,
      bestStreak: won ? Math.max(base.bestStreak, base.streak + 1) : base.bestStreak,
      plays: base.plays + 1,
      firstPlayClaimed: base.firstPlayClaimed || firstPlayBonus > 0,
      lastPlayedAt: now,
    },
    gained: winCoins + firstPlayBonus,
    winCoins,
    firstPlayBonus,
    capped,
  };
}

// ---- 主持人台词层（AI / 本地双通道共用） ----

/** 主持人模式：local=本地模板；ai=AI 生成（未配置或失败时自动降级本地）。 */
export type HostMode = 'local' | 'ai';

/**
 * 主持人事件（仅这 5 类走主持人；普通「大了/小了」提示是本地文案，
 * 不走 AI——这是控费关键：平均每局仅 2~3 次 AI 调用）。
 */
export type HostEvent = 'start' | 'near' | 'win' | 'lose' | 'giveUp';

/** 主持人上下文（seed 驱动本地台词确定性轮换；detail 为现场事实一句话）。 */
export interface HostContext {
  gameId: GameId;
  /** 确定性种子（同局同词；一般传结算前的 plays 数） */
  seed: number;
  /** 当前连胜（结算前） */
  streak: number;
  /** 历史最佳连胜 */
  bestStreak: number;
  /** 现场事实补充（如「还剩 3 次机会」「答案是 42」） */
  detail?: string;
}

/** 本地主持人台词池（无 AI 模式兜底；{game}/{streak}/{best}/{detail} 为占位变量）。 */
export const HOST_LINES: Record<HostEvent, string[]> = {
  start: [
    '{game}开局！我心里已经想好一个数了，来猜吧～{detail}',
    '新的一局{game}！放马过来，{detail}',
    '开始啦！{detail}，猜中可以赚金币哦',
  ],
  near: [
    '哇，差一点儿！{detail}，继续',
    '很接近了！{detail}，调整一下方向',
    '就差一点！{detail}，你可以的',
  ],
  win: [
    '猜中啦！{detail}，厉害厉害',
    '漂亮！{detail}，这局赢得干净利落',
    '答对！{detail}，金币到手',
  ],
  lose: [
    '这局没中，{detail}。最佳 {best} 连胜还在，下局再来',
    '差最后一步！{detail}。别灰心，你的最佳纪录是 {best} 连胜',
    '这局输了，{detail}。最佳 {best} 连胜留着，随时来刷新',
  ],
  giveUp: [
    '好，这局就到这。{detail}，随时回来接着玩',
    '收到，这局收工。{detail}，金币明天还能接着赚',
    '没问题，休息一下。{detail}，我随时待命',
  ],
};

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

/**
 * 本地主持人台词（纯函数）：按 seed 确定性轮换，同 seed 同结果；
 * 未提供占位变量时保留原样（{detail} 缺省时替换为空串由调用方保证）。
 */
export function localHostLine(event: HostEvent, ctx: HostContext): string {
  const pool = HOST_LINES[event];
  const template = pool[Math.abs(Math.trunc(ctx.seed)) % pool.length];
  return fillTemplate(template, {
    game: GAME_LABELS[ctx.gameId],
    streak: ctx.streak,
    best: ctx.bestStreak,
    detail: ctx.detail ?? '',
  });
}

/** 各事件的事实描述（喂给 AI 的 user prompt 用；与 HOST_LINES 的语义一一对应）。 */
const HOST_EVENT_DESC: Record<HostEvent, string> = {
  start: '对局开始',
  near: '玩家猜得很接近（差距在 5 以内）',
  win: '玩家猜中了',
  lose: '玩家用完了机会没猜中',
  giveUp: '玩家主动放弃了本局',
};

/**
 * 构造 AI 主持人 prompt（纯函数）：system 定人设与输出约束，
 * user 给事件与上下文。台词目标 50 字以内——AI 调用宁短勿长。
 */
export function buildHostPrompt(
  event: HostEvent,
  ctx: HostContext
): { system: string; user: string } {
  const system = [
    `你是阅读 App「书时」里小游戏「${GAME_LABELS[ctx.gameId]}」的主持人。`,
    '你的职责是用轻松口语化的方式陪伴玩家，推动对局继续。',
    '要求：简体中文；用「你」称呼玩家；每次不超过 50 字；最多 1 个 emoji；不得编造未提供的信息；不要复述规则细节。',
  ].join('\n');
  const user = [
    `事件：${HOST_EVENT_DESC[event]}。`,
    `当前连胜 ${ctx.streak}，历史最佳 ${ctx.bestStreak} 连胜。`,
    ctx.detail ? `现场情况：${ctx.detail}` : '',
    '请说一句主持人台词。',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}
