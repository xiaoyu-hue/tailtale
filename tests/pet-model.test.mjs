/**
 * pet 模块领域模型单元测试（node:test，零新依赖）。
 * 运行：npm run test（先把 model.ts 单文件编译到 .test-dist/ 再执行本文件）。
 * 覆盖：衰减结算（ awake/sleeping/封顶/想念惩罚/跨天重置）、四件商品效果与约束
 * （冷却/精力门槛/每日上限/成长封顶）、抚摸限次、睡觉唤醒精力回复、成长阶段、情绪推导。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS,
  HOUR_MS,
  PET_RULES,
  SNACKS,
  STAGE_LABELS,
  acknowledgeBond,
  bondMoment,
  currentStage,
  deriveMood,
  feed,
  initialPet,
  settleDecay,
  sleep,
  stroke,
  wake,
} from '../.test-dist/modules/pet/model.js';

const T0 = 1_700_000_000_000; // 固定基准时间戳（测试不依赖真实时钟）
const TODAY = '2026-10-21';
const YESTERDAY = '2026-10-20';

function makePet(overrides = {}) {
  return {
    id: 'pet',
    name: '小咪',
    hunger: 80,
    mood: 80,
    energy: 80,
    affinity: 0,
    growth: 0,
    sleeping: false,
    sleepStartedAt: 0,
    lastDecayAt: T0,
    lastPlayAt: 0,
    strokeDate: TODAY,
    strokesToday: 0,
    affinityDate: TODAY,
    affinityToday: 0,
    skin: 'default',
    unseenBonds: 0,
    ...overrides,
  };
}

// ---- 初始宠物 ----

test('initialPet：默认值', () => {
  const pet = initialPet(TODAY, T0);
  assert.equal(pet.id, 'pet');
  assert.equal(pet.name, '小咪');
  assert.equal(pet.hunger, 80);
  assert.equal(pet.mood, 80);
  assert.equal(pet.energy, 80);
  assert.equal(pet.affinity, 0);
  assert.equal(pet.growth, 0);
  assert.equal(pet.sleeping, false);
  assert.equal(pet.lastDecayAt, T0);
  assert.equal(pet.strokeDate, TODAY);
  assert.equal(pet.affinityDate, TODAY);
  assert.equal(pet.skin, 'default');
  assert.equal(pet.unseenBonds, 0);
});

// ---- 衰减结算 ----

test('settleDecay：清醒 24 小时按日速衰减', () => {
  const pet = settleDecay(makePet(), T0 + DAY_MS, TODAY);
  assert.equal(pet.hunger, 50); // 80 - 30
  assert.equal(pet.mood, 60); // 80 - 20
  assert.equal(pet.energy, 60); // 80 - 20
  assert.equal(pet.affinity, 0); // 饱食 50 > 20，无想念惩罚
  assert.equal(pet.lastDecayAt, T0 + DAY_MS);
});

test('settleDecay：48 小时，第二天饱食跌破 20 触发想念惩罚', () => {
  const pet = settleDecay(makePet({ affinity: 30 }), T0 + 2 * DAY_MS, TODAY);
  assert.equal(pet.hunger, 20); // 第二天结算后恰为 20
  assert.equal(pet.affinity, 28); // 30 - 2（仅第二天罚）
  assert.equal(pet.mood, 40);
  assert.equal(pet.energy, 40);
});

test('settleDecay：离线封顶 7 天，10 天与 7 天同价', () => {
  const tenDays = settleDecay(makePet({ affinity: 30 }), T0 + 10 * DAY_MS, TODAY);
  const sevenDays = settleDecay(makePet({ affinity: 30 }), T0 + 7 * DAY_MS, TODAY);
  assert.equal(tenDays.hunger, 0);
  assert.equal(tenDays.mood, 0);
  assert.equal(tenDays.energy, 0);
  assert.equal(tenDays.affinity, 18); // 第 2~7 天共 6 次惩罚：30 - 12
  assert.deepEqual(
    { h: tenDays.hunger, m: tenDays.mood, e: tenDays.energy, a: tenDays.affinity },
    { h: sevenDays.hunger, m: sevenDays.mood, e: sevenDays.energy, a: sevenDays.affinity }
  );
});

test('settleDecay：3 天两条想念惩罚，好感不低于 0', () => {
  const pet = settleDecay(makePet({ affinity: 1 }), T0 + 3 * DAY_MS, TODAY);
  assert.equal(pet.hunger, 0);
  assert.equal(pet.affinity, 0); // max(0, 1 - 4)
});

test('settleDecay：睡觉时饱食衰减减半、心情与精力不衰减', () => {
  const pet = settleDecay(makePet({ sleeping: true }), T0 + DAY_MS, TODAY);
  assert.equal(pet.hunger, 65); // 80 - 15
  assert.equal(pet.mood, 80);
  assert.equal(pet.energy, 80);
});

test('settleDecay：连睡 3 天饱食仍高于想念线，不惩罚', () => {
  const pet = settleDecay(makePet({ sleeping: true }), T0 + 3 * DAY_MS, TODAY);
  assert.equal(pet.hunger, 35); // 80 - 45
  assert.equal(pet.affinity, 0);
});

test('settleDecay：零耗时返回原引用（便于调用方跳过写库）', () => {
  const pet = makePet();
  assert.equal(settleDecay(pet, T0, TODAY), pet);
});

test('settleDecay：时钟回拨不产生负衰减', () => {
  const pet = makePet();
  const settled = settleDecay(pet, T0 - 60_000, TODAY);
  assert.equal(settled, pet);
  assert.equal(settled.hunger, 80);
});

test('settleDecay：每日计数按日期键跨天重置', () => {
  const pet = settleDecay(
    makePet({ strokeDate: YESTERDAY, strokesToday: 2, affinityDate: YESTERDAY, affinityToday: 9 }),
    T0,
    TODAY
  );
  assert.equal(pet.strokeDate, TODAY);
  assert.equal(pet.strokesToday, 0);
  assert.equal(pet.affinityDate, TODAY);
  assert.equal(pet.affinityToday, 0);
});

// ---- 零食/玩具（feed） ----

test('feed 小鱼干：饱食 +30（封顶 100）、好感 +2', () => {
  const result = feed(makePet(), 'dried_fish', T0, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.hunger, 100); // 80 + 30 = 110 → 100
  assert.equal(result.pet.affinity, 2);
  assert.equal(result.pet.growth, 2);
  assert.equal(result.pet.affinityToday, 2);
  assert.equal(result.affinityGained, 2);
});

test('feed 猫条：饱食 +50、好感 +8', () => {
  const result = feed(makePet({ hunger: 40 }), 'cat_tube', T0, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.hunger, 90);
  assert.equal(result.pet.affinity, 8);
});

test('feed 猫薄荷：全属性 +20，好感受每日上限截到 +10', () => {
  const result = feed(makePet(), 'catnip', T0, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.hunger, 100);
  assert.equal(result.pet.mood, 100);
  assert.equal(result.pet.energy, 100);
  assert.equal(result.pet.affinity, 10); // 想要 +15，上限 +10
  assert.equal(result.affinityGained, 10);
});

test('feed 逗猫棒：心情 +40、精力 -15、好感 +5、记录时间', () => {
  const result = feed(makePet(), 'cat_rod', T0, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.mood, 100); // 80 + 40 = 120 → 100
  assert.equal(result.pet.energy, 65);
  assert.equal(result.pet.affinity, 5);
  assert.equal(result.pet.lastPlayAt, T0);
});

test('feed 逗猫棒：4 小时冷却内拒绝，期满放行', () => {
  const base = makePet();
  const first = feed(base, 'cat_rod', T0, TODAY);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const tooSoon = feed(first.pet, 'cat_rod', T0 + 4 * HOUR_MS - 1, TODAY);
  assert.equal(tooSoon.ok, false);
  if (tooSoon.ok) return;
  assert.equal(tooSoon.reason, 'cooldown');
  const cooled = feed(first.pet, 'cat_rod', T0 + 4 * HOUR_MS, TODAY);
  assert.equal(cooled.ok, true);
});

test('feed 逗猫棒：精力不足 15 玩不动，等于 15 可玩', () => {
  const tired = feed(makePet({ energy: 14 }), 'cat_rod', T0, TODAY);
  assert.equal(tired.ok, false);
  if (tired.ok) return;
  assert.equal(tired.reason, 'tired');
  const enough = feed(makePet({ energy: 15 }), 'cat_rod', T0, TODAY);
  assert.equal(enough.ok, true);
  if (!enough.ok) return;
  assert.equal(enough.pet.energy, 0);
});

test('feed：睡觉中拒绝，且返回结算后的状态', () => {
  const result = feed(makePet({ sleeping: true }), 'dried_fish', T0 + DAY_MS, TODAY);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'sleeping');
  assert.equal(result.pet?.hunger, 65); // 睡觉态衰减已结算
});

test('feed：先结算离线衰减再生效', () => {
  const result = feed(makePet(), 'dried_fish', T0 + DAY_MS, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.hunger, 80); // 80 - 30 + 30
  assert.equal(result.pet.mood, 60);
  assert.equal(result.pet.energy, 60);
  assert.equal(result.pet.affinity, 2);
});

test('feed：好感每日上限跨动作累计（抚摸+逗猫棒+猫条 = 10）', () => {
  const stroked = stroke(makePet(), T0, TODAY);
  assert.equal(stroked.ok, true);
  if (!stroked.ok) return;
  const played = feed(stroked.pet, 'cat_rod', T0, TODAY);
  assert.equal(played.ok, true);
  if (!played.ok) return;
  assert.equal(played.pet.affinityToday, 6); // 1 + 5
  const tubed = feed(played.pet, 'cat_tube', T0, TODAY);
  assert.equal(tubed.ok, true);
  if (!tubed.ok) return;
  assert.equal(tubed.pet.affinityToday, 10); // 还想 +8，只剩 4 的额度
  assert.equal(tubed.affinityGained, 4);
  assert.equal(tubed.pet.affinity, 10);
  const again = feed(tubed.pet, 'dried_fish', T0, TODAY);
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.affinityGained, 0); // 今日额度用尽
});

test('feed：成长值封顶 400', () => {
  const result = feed(makePet({ growth: 399 }), 'dried_fish', T0, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.growth, 400); // min(400, 399 + 2)
  assert.equal(result.pet.affinity, 2); // 好感度本身不封顶
});

// ---- 抚摸（stroke） ----

test('stroke：心情 +5、好感 +1、计数 +1', () => {
  const result = stroke(makePet(), T0, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.mood, 85);
  assert.equal(result.pet.affinity, 1);
  assert.equal(result.pet.strokesToday, 1);
  assert.equal(result.affinityGained, 1);
});

test('stroke：每日 2 次后用尽拒绝', () => {
  const first = stroke(makePet(), T0, TODAY);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = stroke(first.pet, T0, TODAY);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.pet.strokesToday, 2);
  const third = stroke(second.pet, T0, TODAY);
  assert.equal(third.ok, false);
  if (third.ok) return;
  assert.equal(third.reason, 'strokes-used');
  assert.equal(third.pet?.affinity, 2); // 状态不被破坏
});

test('stroke：睡觉中拒绝', () => {
  const result = stroke(makePet({ sleeping: true }), T0, TODAY);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'sleeping');
});

// ---- 睡觉/唤醒 ----

test('sleep：入睡记录开始时间，重复入睡拒绝', () => {
  const result = sleep(makePet(), T0, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.sleeping, true);
  assert.equal(result.pet.sleepStartedAt, T0);
  const again = sleep(result.pet, T0, TODAY);
  assert.equal(again.ok, false);
  if (again.ok) return;
  assert.equal(again.reason, 'already-sleeping');
});

test('wake：按睡眠时长回精力，6 小时封顶 +40', () => {
  const slept = sleep(makePet(), T0, TODAY);
  assert.equal(slept.ok, true);
  if (!slept.ok) return;
  const result = wake(slept.pet, T0 + 6 * HOUR_MS, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.energy, 100); // 80 + min(40, 60)
  assert.equal(result.pet.sleeping, false);
  assert.equal(result.pet.sleepStartedAt, 0);
  assert.equal(result.pet.affinity, 1); // 睡醒好感 +1
});

test('wake：半小时回 5 点精力；10 小时仍只 +40', () => {
  const slept = sleep(makePet({ energy: 50 }), T0, TODAY);
  assert.equal(slept.ok, true);
  if (!slept.ok) return;
  const nap = wake(slept.pet, T0 + 30 * 60 * 1000, TODAY);
  assert.equal(nap.ok, true);
  if (!nap.ok) return;
  assert.equal(nap.pet.energy, 55); // 50 + round(0.5 * 10)

  const long = wake(slept.pet, T0 + 10 * HOUR_MS, TODAY);
  assert.equal(long.ok, true);
  if (!long.ok) return;
  assert.equal(long.pet.energy, 90); // 50 + 40
});

test('wake：连睡 3 天按睡觉态结算衰减，醒后回满精力', () => {
  const slept = sleep(makePet(), T0, TODAY);
  assert.equal(slept.ok, true);
  if (!slept.ok) return;
  const result = wake(slept.pet, T0 + 3 * DAY_MS, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.hunger, 35); // 睡觉态：80 - 45
  assert.equal(result.pet.mood, 80);
  assert.equal(result.pet.energy, 100); // 80 + 40（封顶）
  assert.equal(result.pet.affinity, 1);
});

test('wake：清醒时拒绝', () => {
  const result = wake(makePet(), T0, TODAY);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'awake');
});

test('wake：好感额度用尽时不刷好感', () => {
  const slept = sleep(makePet({ affinityToday: 10 }), T0, TODAY);
  assert.equal(slept.ok, true);
  if (!slept.ok) return;
  const result = wake(slept.pet, T0 + 2 * HOUR_MS, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.affinityGained, 0);
  assert.equal(result.pet.affinity, 0);
  assert.equal(result.pet.affinityToday, 10);
});

// ---- 成长阶段与情绪 ----

test('currentStage：四档阈值', () => {
  assert.equal(currentStage(0), 'baby');
  assert.equal(currentStage(49), 'baby');
  assert.equal(currentStage(50), 'teen');
  assert.equal(currentStage(149), 'teen');
  assert.equal(currentStage(150), 'adult');
  assert.equal(currentStage(399), 'adult');
  assert.equal(currentStage(400), 'full');
});

test('deriveMood：睡觉优先，其余按最紧迫需求', () => {
  assert.equal(deriveMood(makePet({ sleeping: true, hunger: 0 })), 'sleeping');
  assert.equal(deriveMood(makePet({ hunger: 20 })), 'hungry');
  assert.equal(deriveMood(makePet({ hunger: 21, energy: 15 })), 'tired');
  assert.equal(deriveMood(makePet({ energy: 16, mood: 30 })), 'sad');
  assert.equal(deriveMood(makePet({ mood: 80 })), 'happy');
  assert.equal(deriveMood(makePet({ mood: 50 })), 'content');
});

// ---- 数值表与 PRD 对齐守卫（防手误改数） ----

test('PET_RULES：关键数值与 PRD/决策一致', () => {
  assert.equal(PET_RULES.STROKE_DAILY_FREE, 2);
  assert.equal(PET_RULES.AFFINITY_DAILY_CAP, 10);
  assert.equal(PET_RULES.MISSING_HUNGER, 20);
  assert.equal(PET_RULES.MISSING_AFFINITY_PER_DAY, 2);
  assert.equal(PET_RULES.STAGE_TEEN, 50);
  assert.equal(PET_RULES.STAGE_ADULT, 150);
  assert.equal(PET_RULES.GROWTH_CAP, 400);
  assert.equal(PET_RULES.HUNGER_DECAY_PER_DAY, 30);
  assert.equal(PET_RULES.MOOD_DECAY_PER_DAY, 20);
  assert.equal(PET_RULES.ENERGY_DECAY_PER_DAY, 20);
  assert.equal(PET_RULES.MAX_DECAY_DAYS, 7);
  assert.equal(PET_RULES.PLAY_ENERGY_COST, 15);
  assert.equal(PET_RULES.SLEEP_ENERGY_PER_HOUR, 10);
  assert.equal(PET_RULES.SLEEP_ENERGY_CAP, 40);
  assert.equal(PET_RULES.WAKE_AFFINITY, 1);
  assert.equal(DAY_MS, 86_400_000);
  assert.equal(HOUR_MS, 3_600_000);
});

test('SNACKS：四件商品与 PRD §3.1.2 一致', () => {
  assert.deepEqual(SNACKS.dried_fish, { name: '小鱼干', coins: 15, hunger: 30, affinity: 2 });
  assert.deepEqual(SNACKS.cat_tube, { name: '猫条', coins: 35, hunger: 50, affinity: 8 });
  assert.deepEqual(SNACKS.catnip, {
    name: '猫薄荷',
    coins: 60,
    hunger: 20,
    mood: 20,
    energy: 20,
    affinity: 15,
  });
  assert.equal(SNACKS.cat_rod.name, '逗猫棒');
  assert.equal(SNACKS.cat_rod.coins, 20);
  assert.equal(SNACKS.cat_rod.mood, 40);
  assert.equal(SNACKS.cat_rod.energy, -15);
  assert.equal(SNACKS.cat_rod.affinity, 5);
  assert.equal(SNACKS.cat_rod.cooldownMs, 4 * HOUR_MS);
});

// ---- 成长阶段名与羁绊时刻 ----

test('STAGE_LABELS：四档中文名（小猫档为用户定名）', () => {
  assert.deepEqual(STAGE_LABELS, { baby: '小猫', teen: '少年猫', adult: '成年猫', full: '完全体' });
});

test('bondMoment：好感 +5 且累计未看次数', () => {
  const result = bondMoment(makePet(), T0, TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pet.affinity, 5);
  assert.equal(result.pet.growth, 5);
  assert.equal(result.pet.unseenBonds, 1);
  const second = bondMoment(result.pet, T0, TODAY);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.pet.unseenBonds, 2);
  assert.equal(second.pet.affinity, 10); // 恰好顶到每日上限
  const third = bondMoment(second.pet, T0, TODAY);
  assert.equal(third.ok, true);
  if (!third.ok) return;
  assert.equal(third.affinityGained, 0); // 今日额度用尽
  assert.equal(third.pet.unseenBonds, 3); // 动画次数仍累计
});

test('bondMoment：跨天重置后额度恢复', () => {
  const first = bondMoment(makePet(), T0, TODAY);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const nextDay = bondMoment(first.pet, T0 + DAY_MS, '2026-10-22');
  assert.equal(nextDay.ok, true);
  if (!nextDay.ok) return;
  assert.equal(nextDay.pet.affinity, 10); // 5 + 5（新的一天额度重置）
  assert.equal(nextDay.pet.unseenBonds, 2);
});

test('acknowledgeBond：清零未看计数（无变化返回原引用）', () => {
  const bonded = bondMoment(makePet(), T0, TODAY);
  assert.equal(bonded.ok, true);
  if (!bonded.ok) return;
  const acked = acknowledgeBond(bonded.pet, T0, TODAY);
  assert.equal(acked.unseenBonds, 0);
  assert.notEqual(acked, bonded.pet); // 有变化 → 新对象
  assert.equal(acknowledgeBond(acked, T0, TODAY), acked); // 无变化 → 原引用
});
