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

/** 对局流水行（db 'tailtale' 的 game_matches store，自增 id；战绩查询用）。 */
export interface GameMatch {
  /** 自增 id（db 分配） */
  id?: number;
  gameId: GameId;
  /** 对局结果：胜 / 负 / 平（平局不奖不罚但计入流水） */
  result: 'won' | 'lost' | 'draw';
  /** 本局实发金币（平局为 0） */
  coins: number;
  /** 对局结束时间戳 */
  playedAt: number;
}

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

// ---- 四选一猜词游戏出题层（猜成语 / 猜歇后语 / 脑筋急转弯共用） ----

import { IDIOMS, PROVERBS, TEASERS } from './data/quizBank.js';

/** 四选一游戏 id（共用 QuizGame 组件与出题函数）。 */
export type QuizGameId = 'guess_idiom' | 'guess_riddle' | 'brain_teaser';

/** 一轮四选一题目（纯数据，UI 直接渲染）。 */
export interface QuizRound {
  /** 题干（成语=释义；歇后语=前半句；急转弯=原题） */
  prompt: string;
  /** 4 个选项（已按 seed 确定性打乱，互异） */
  options: string[];
  /** 正确选项下标 */
  answerIndex: number;
  /** 正确答案（= options[answerIndex]，结算/提示用） */
  answer: string;
}

/** 确定性伪随机（LCG）：同 seed 同序列，供抽题与选项打乱使用。 */
function makeRng(seed: number): () => number {
  let s = (Math.abs(Math.trunc(seed)) * 1103515245 + 12345) & 0x7fffffff;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * 生成一轮四选一题目（纯函数）：同 seed 同结果（可单测、可复现对局）。
 * - 抽题：idx = seed % bank.length；
 * - 干扰项：LCG 序列取样 3 个 ≠ idx 的下标（题库答案唯一，无多解歧义）；
 * - 选项位次：答案放入 rng 生成的随机位，干扰按取样顺序填充其余位。
 */
export function buildQuizRound(gameId: QuizGameId, seed: number): QuizRound {
  const bank: Array<{ prompt: string; answer: string }> =
    gameId === 'guess_idiom'
      ? IDIOMS.map((it) => ({ prompt: it.meaning, answer: it.idiom }))
      : gameId === 'guess_riddle'
        ? PROVERBS.map((it) => ({ prompt: it.front, answer: it.back }))
        : TEASERS.map((it) => ({ prompt: it.q, answer: it.a }));
  const idx = Math.abs(Math.trunc(seed)) % bank.length;
  const rng = makeRng(seed + 1);

  const distractors: string[] = [];
  const taken = new Set<number>([idx]);
  let guard = 0;
  while (distractors.length < 3 && guard++ < 500) {
    const j = Math.floor(rng() * bank.length) % bank.length;
    if (taken.has(j)) continue;
    taken.add(j);
    distractors.push(bank[j].answer);
  }
  // 题库 >= 4 条时 guard 必然成功；兜底（题库被改坏时）用相邻条目
  for (let k = 1; distractors.length < 3; k += 1) {
    const j = (idx + k) % bank.length;
    if (taken.has(j)) continue;
    taken.add(j);
    distractors.push(bank[j].answer);
  }

  const answerIndex = Math.floor(rng() * 4) % 4;
  const options: string[] = ['', '', '', ''];
  options[answerIndex] = bank[idx].answer;
  let cursor = 0;
  for (let slot = 0; slot < 4; slot += 1) {
    if (slot === answerIndex) continue;
    options[slot] = distractors[cursor];
    cursor += 1;
  }
  return { prompt: bank[idx].prompt, options, answerIndex, answer: bank[idx].answer };
}

// ---- 主持人台词层（AI / 本地双通道共用） ----

/** 主持人模式：local=本地模板；ai=AI 生成（未配置或失败时自动降级本地）。 */
export type HostMode = 'local' | 'ai';

/**
 * 主持人事件（仅这 5 类走主持人；普通「大了/小了」提示是本地文案，
 * 不走 AI——这是控费关键：平均每局仅 2~3 次 AI 调用）。
 */
export type HostEvent = 'start' | 'near' | 'win' | 'lose' | 'giveUp' | 'draw';

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
    '{game}开局！我已经准备好了，来猜吧～{detail}',
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
  draw: [
    '平局！{detail}，棋逢对手，将遇良才',
    '不分胜负！{detail}，下次一定分个高下',
    '和棋！{detail}，下次再来一决雌雄',
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
  draw: '对局以平局收场（棋盘下满，无人成五）',
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

// ---- 局后 AI 点评与追问（结束面板「问下去」；全部用户主动触发） ----

/** 对局结果（平局也点评；与结算口径一致）。 */
export type GameOutcome = 'won' | 'lost' | 'draw';

/**
 * 对局小结（喂给 AI 点评的现场事实；与结算结果同源，UI 在结束面板构造）。
 * detail 为纯事实一句话（不含评价），coins 为本局实发金币（0=未发放）。
 */
export interface GameSummary {
  gameId: GameId;
  outcome: GameOutcome;
  /** 现场事实一句话（如「用了 4 次猜中」「10 题答对 7 题」「AI 先成五」） */
  detail: string;
  /** 本局实发金币 */
  coins: number;
}

/** 一轮对话（追问历史以拼接方式传入 chatOnce，无会话缓存——每次调用都产生费用）。 */
export interface FollowUpTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** 结果的事实描述（喂给 AI 的 user prompt 用；与 GameSummary.outcome 一一对应）。 */
const OUTCOME_DESC: Record<GameOutcome, string> = {
  won: '玩家获胜',
  lost: '玩家落败',
  draw: '平局',
};

/**
 * 构造局后点评 prompt（纯函数）：system 复用主人口径（简体中文 / 「你」称呼 /
 * 不编造），点评上限 100 字（复盘性质比台词长，仍守「宁短勿长」）；
 * user 给对局事实，要求一句话点评 + 一个可操作建议。
 */
export function buildReviewPrompt(summary: GameSummary): { system: string; user: string } {
  const system = [
    `你是阅读 App「书时」里小游戏「${GAME_LABELS[summary.gameId]}」的主持人。`,
    '对局刚结束，玩家请你点评这一局。',
    '要求：简体中文；用「你」称呼玩家；不超过 100 字；最多 1 个 emoji；只基于提供的对局事实评价，不得编造未提供的信息；语气轻松，落败不嘲讽。',
  ].join('\n');
  const user = [
    `对局结果：${OUTCOME_DESC[summary.outcome]}。`,
    `现场情况：${summary.detail}`,
    summary.coins > 0 ? `本局获得 ${summary.coins} 金币。` : '本局没有获得金币。',
    '请点评这一局的表现，并给一个下次能用得上的建议。',
  ].join('\n');
  return { system, user };
}

/**
 * 构造追问 prompt（纯函数）：把对局事实 + 历史对话 + 当前问题拼进单轮 user
 * （chatOnce 无会话缓存，历史由调用方拼接传入）；system 约束同点评口径，
 * 回答上限 150 字；历史缺省时只带对局事实。
 */
export function buildFollowUpPrompt(
  summary: GameSummary,
  history: FollowUpTurn[],
  question: string
): { system: string; user: string } {
  const system = [
    `你是阅读 App「书时」里小游戏「${GAME_LABELS[summary.gameId]}」的主持人。`,
    '玩家在看完这局点评后继续向你提问，请基于对局事实和对话历史回答。',
    '要求：简体中文；用「你」称呼玩家；不超过 150 字；最多 1 个 emoji；不得编造未提供的信息；与游戏无关的问题礼貌说明你只聊这局对局。',
  ].join('\n');
  const lines = [
    `对局结果：${OUTCOME_DESC[summary.outcome]}。`,
    `现场情况：${summary.detail}`,
  ];
  if (history.length > 0) {
    lines.push('对话历史：');
    for (const turn of history) {
      lines.push(`${turn.role === 'user' ? '玩家' : '主持人'}：${turn.content}`);
    }
  }
  lines.push(`当前问题：${question}`, '请回答。');
  return { system, user: lines.join('\n') };
}

/** 推荐追问（结束面板 chips；纯本地常量，不花 AI 费用——点击才发起追问）。 */
const FOLLOW_UP_SUGGESTIONS: Record<GameOutcome, string[]> = {
  won: ['这局我哪里做得好？', '有没有更快赢下的方法？', '下次怎么保持连胜？'],
  lost: ['这局我输在哪一步？', '换你会怎么走？', '下次怎么提高胜率？'],
  draw: ['平局算下得不错吗？', '哪一步改变了局势？', '怎么才能赢下来？'],
};

/**
 * 推荐追问列表（纯函数）：按对局结果给 3 条口语化问题；
 * 返回新数组（调用方改不坏常量池），内容互异且非空。
 */
export function suggestFollowUps(summary: GameSummary): string[] {
  return [...FOLLOW_UP_SUGGESTIONS[summary.outcome]];
}
