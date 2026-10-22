/**
 * gamification 模块领域模型单元测试（node:test，零新依赖）。
 * 运行：npm run test（model.ts 与 shared/dates.ts 一并编译到 .test-dist/ 再执行本文件）。
 * 覆盖：金币换算（coinsForReadMinutes 分档边界）、连续打卡奖励（streakBonus 递增与封顶）、
 * 奖励推导（pendingAwards 分钟/XP/金币一致性）、连续天数计算（computeStreak 含跨月、
 * 断档、重复日期）、跨日结转（rolloverDaily 同日引用不变/跨日重置保留资产）、初始钱包。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ECONOMY,
  SESSION_ID,
  WALLET_ID,
  coinsForReadMinutes,
  computeStreak,
  initialWallet,
  pendingAwards,
  rolloverDaily,
  streakBonus,
} from '../.test-dist/modules/gamification/model.js';

const TODAY = '2026-10-21';
const YESTERDAY = '2026-10-20';
const DAY_BEFORE = '2026-10-19';

// ---- coinsForReadMinutes：每 30 分钟 +10 币，向下取整 ----

test('coinsForReadMinutes：不足一个周期为 0', () => {
  assert.equal(coinsForReadMinutes(0), 0);
  assert.equal(coinsForReadMinutes(1), 0);
  assert.equal(coinsForReadMinutes(ECONOMY.COINS_PER_MINUTES - 1), 0);
});

test('coinsForReadMinutes：每到整周期 +10', () => {
  assert.equal(coinsForReadMinutes(ECONOMY.COINS_PER_MINUTES), ECONOMY.COINS_PER_BLOCK);
  assert.equal(coinsForReadMinutes(ECONOMY.COINS_PER_MINUTES + 1), ECONOMY.COINS_PER_BLOCK);
  assert.equal(coinsForReadMinutes(ECONOMY.COINS_PER_MINUTES * 2), ECONOMY.COINS_PER_BLOCK * 2);
  assert.equal(coinsForReadMinutes(ECONOMY.COINS_PER_MINUTES * 2 - 1), ECONOMY.COINS_PER_BLOCK);
  assert.equal(coinsForReadMinutes(ECONOMY.COINS_PER_MINUTES * 10), ECONOMY.COINS_PER_BLOCK * 10);
});

// ---- streakBonus：第 3 天起每天 +2，上限 10 ----

test('streakBonus：前两天无奖励', () => {
  assert.equal(streakBonus(0), 0);
  assert.equal(streakBonus(1), 0);
  assert.equal(streakBonus(ECONOMY.STREAK_FROM_DAY - 1), 0);
});

test('streakBonus：第 3 天起线性递增', () => {
  assert.equal(streakBonus(3), ECONOMY.STREAK_STEP);
  assert.equal(streakBonus(4), ECONOMY.STREAK_STEP * 2);
  assert.equal(streakBonus(5), ECONOMY.STREAK_STEP * 3);
  assert.equal(streakBonus(6), ECONOMY.STREAK_STEP * 4);
});

test('streakBonus：达到上限后不再增长', () => {
  assert.equal(streakBonus(7), ECONOMY.STREAK_CAP);
  assert.equal(streakBonus(8), ECONOMY.STREAK_CAP);
  assert.equal(streakBonus(365), ECONOMY.STREAK_CAP);
});

// ---- pendingAwards：由累计毫秒推导分钟/XP/金币 ----

test('pendingAwards：不足整分钟全部为 0', () => {
  assert.deepEqual(pendingAwards(0), { minutes: 0, xp: 0, coins: 0 });
  assert.deepEqual(pendingAwards(59_999), { minutes: 0, xp: 0, coins: 0 });
});

test('pendingAwards：整分钟向下取整，XP 每分钟 1 点', () => {
  const one = pendingAwards(60_000);
  assert.equal(one.minutes, 1);
  assert.equal(one.xp, ECONOMY.XP_PER_MINUTE);
  const half = pendingAwards(90_000); // 1.5 分钟只算 1 分钟
  assert.equal(half.minutes, 1);
  assert.equal(half.xp, 1);
});

test('pendingAwards：金币与 coinsForReadMinutes 保持一致', () => {
  for (const minutes of [1, 29, 30, 31, 60, 90, 120, 300]) {
    const awards = pendingAwards(minutes * 60_000);
    assert.equal(awards.minutes, minutes);
    assert.equal(awards.xp, minutes * ECONOMY.XP_PER_MINUTE);
    assert.equal(awards.coins, coinsForReadMinutes(minutes));
  }
});

test('pendingAwards：跨过周期点时金币正确跳档', () => {
  assert.equal(pendingAwards(ECONOMY.COINS_PER_MINUTES * 60_000).coins, ECONOMY.COINS_PER_BLOCK);
  assert.equal(pendingAwards((ECONOMY.COINS_PER_MINUTES + 1) * 60_000).coins, ECONOMY.COINS_PER_BLOCK);
  assert.equal(pendingAwards(ECONOMY.COINS_PER_MINUTES * 2 * 60_000).coins, ECONOMY.COINS_PER_BLOCK * 2);
});

// ---- computeStreak：连续天数 ----

test('computeStreak：无记录为 0', () => {
  assert.equal(computeStreak([], TODAY), 0);
});

test('computeStreak：仅今天打卡为 1', () => {
  assert.equal(computeStreak([TODAY], TODAY), 1);
});

test('computeStreak：今天未打但昨天打了，返回截至昨天的连续值', () => {
  assert.equal(computeStreak([YESTERDAY], TODAY), 1);
  assert.equal(computeStreak([YESTERDAY, DAY_BEFORE], TODAY), 2);
});

test('computeStreak：今天 + 昨天连续为 2', () => {
  assert.equal(computeStreak([TODAY, YESTERDAY], TODAY), 2);
  assert.equal(computeStreak([TODAY, YESTERDAY, DAY_BEFORE], TODAY), 3);
});

test('computeStreak：中间断档只数到最近的一段', () => {
  assert.equal(computeStreak([TODAY, DAY_BEFORE], TODAY), 1);
  assert.equal(computeStreak([TODAY, '2026-10-10'], TODAY), 1);
});

test('computeStreak：昨天也没打则归零（当天尚未结束不清零的语义由昨天有打保证）', () => {
  assert.equal(computeStreak([DAY_BEFORE], TODAY), 0);
  assert.equal(computeStreak(['2026-10-01'], TODAY), 0);
});

test('computeStreak：跨月连续正确计数', () => {
  assert.equal(computeStreak(['2026-11-01', '2026-10-31', '2026-10-30'], '2026-11-01'), 3);
  assert.equal(computeStreak(['2026-10-01', '2026-09-30'], '2026-10-01'), 2);
});

test('computeStreak：重复日期不重复计数（Set 去重）', () => {
  assert.equal(computeStreak([TODAY, TODAY, YESTERDAY, YESTERDAY], TODAY), 2);
});

// ---- rolloverDaily：跨日重置 ----

test('rolloverDaily：同日返回原对象引用（调用方可跳过写入）', () => {
  const wallet = initialWallet(TODAY);
  assert.equal(rolloverDaily(wallet, TODAY), wallet);
});

test('rolloverDaily：跨日重置今日分钟但保留资产', () => {
  const wallet = { ...initialWallet(YESTERDAY), coins: 100, xp: 42, todayMinutes: 30 };
  const next = rolloverDaily(wallet, TODAY);
  assert.equal(next.todayDate, TODAY);
  assert.equal(next.todayMinutes, 0);
  assert.equal(next.coins, 100);
  assert.equal(next.xp, 42);
  assert.notEqual(next, wallet); // 新对象，不改原对象
});

// ---- initialWallet 与常量 ----

test('initialWallet：零资产起步', () => {
  const wallet = initialWallet(TODAY);
  assert.equal(wallet.id, WALLET_ID);
  assert.equal(wallet.coins, 0);
  assert.equal(wallet.xp, 0);
  assert.equal(wallet.todayDate, TODAY);
  assert.equal(wallet.todayMinutes, 0);
});

test('常量：数值与 PRD §3.1.1 一致的自洽性', () => {
  assert.equal(ECONOMY.COINS_PER_BLOCK, 10);
  assert.equal(ECONOMY.COINS_PER_MINUTES, 30);
  assert.equal(ECONOMY.CHECKIN_COINS, 5);
  assert.equal(ECONOMY.CHECKIN_MIN_MINUTES, 1);
  assert.equal(ECONOMY.STREAK_FROM_DAY, 3);
  assert.equal(ECONOMY.STREAK_STEP, 2);
  assert.equal(ECONOMY.STREAK_CAP, 10);
  assert.equal(ECONOMY.BOOK_FINISH_COINS, 100);
  assert.equal(ECONOMY.XP_PER_MINUTE, 1);
  assert.equal(ECONOMY.BOND_BLOCK_MINUTES, 30);
  assert.equal(SESSION_ID, 'current');
});
