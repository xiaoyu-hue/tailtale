/**
 * games 模块领域模型单元测试（node:test，零新依赖）。
 * 运行：npm run test（model.ts 编译到 .test-dist/ 后执行本文件）。
 * 覆盖：金币经济表（六游戏数值与日上限合计 50）、对局记录初始化与跨日重置、
 * 奖励结算（首玩叠加 / 连胜累计 / 上限截断 / 跨日恢复 / 判负清零保留最佳）、
 * 主持人台词（本地池确定性与占位符、AI prompt 构造）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_PLAY_COINS,
  GAME_ECONOMY,
  GAME_LABELS,
  buildHostPrompt,
  initialGameRecord,
  localHostLine,
  rolloverGameRecord,
  settleGameReward,
} from '../.test-dist/modules/games/model.js';

const TODAY = '2026-10-25';
const YESTERDAY = '2026-10-24';
const NOW = 1_800_000_000_000;

// ---- 经济表 ----

test('GAME_ECONOMY：六游戏数值与 PRD §3.1.1 一致', () => {
  assert.deepEqual(GAME_ECONOMY.guess_number, { winCoins: 1, dailyCap: 5 });
  assert.deepEqual(GAME_ECONOMY.guess_idiom, { winCoins: 2, dailyCap: 10 });
  assert.deepEqual(GAME_ECONOMY.guess_riddle, { winCoins: 2, dailyCap: 10 });
  assert.deepEqual(GAME_ECONOMY.brain_teaser, { winCoins: 2, dailyCap: 10 });
  assert.deepEqual(GAME_ECONOMY.gomoku, { winCoins: 3, dailyCap: 9 });
  assert.deepEqual(GAME_ECONOMY.tictactoe, { winCoins: 2, dailyCap: 6 });
  assert.equal(FIRST_PLAY_COINS, 3);
});

test('GAME_ECONOMY：六游戏日上限合计 50（与「金币多一点」长期目标对齐）', () => {
  const total = Object.values(GAME_ECONOMY).reduce((sum, rule) => sum + rule.dailyCap, 0);
  assert.equal(total, 50);
});

test('GAME_LABELS：六个中文显示名', () => {
  assert.equal(GAME_LABELS.guess_number, '猜数字');
  assert.equal(GAME_LABELS.gomoku, '五子棋');
  assert.equal(Object.keys(GAME_LABELS).length, Object.keys(GAME_ECONOMY).length);
});

// ---- 记录初始化与跨日重置 ----

test('initialGameRecord：零值与日期键', () => {
  const record = initialGameRecord('guess_number', TODAY, NOW);
  assert.deepEqual(record, {
    gameId: 'guess_number',
    earnedDate: TODAY,
    earnedToday: 0,
    streak: 0,
    bestStreak: 0,
    plays: 0,
    firstPlayClaimed: false,
    lastPlayedAt: NOW,
  });
});

test('rolloverGameRecord：同日返回原引用', () => {
  const record = initialGameRecord('guess_number', TODAY, NOW);
  assert.equal(rolloverGameRecord(record, TODAY), record);
});

test('rolloverGameRecord：跨日重置 earnedToday 且保留其余字段', () => {
  const record = {
    ...initialGameRecord('guess_number', YESTERDAY, NOW),
    earnedToday: 5,
    streak: 3,
    bestStreak: 7,
    plays: 12,
    firstPlayClaimed: true,
  };
  const rolled = rolloverGameRecord(record, TODAY);
  assert.equal(rolled.earnedDate, TODAY);
  assert.equal(rolled.earnedToday, 0);
  assert.equal(rolled.streak, 3);
  assert.equal(rolled.bestStreak, 7);
  assert.equal(rolled.plays, 12);
  assert.equal(rolled.firstPlayClaimed, true);
  assert.notEqual(rolled, record);
});

// ---- 奖励结算 ----

test('settleGameReward：首玩+首胜 gained=4 且 firstPlayClaimed 置位', () => {
  const base = initialGameRecord('guess_number', TODAY, NOW);
  const { record, gained, winCoins, firstPlayBonus, capped } = settleGameReward(
    base,
    'guess_number',
    true,
    TODAY,
    NOW
  );
  assert.equal(gained, 4);
  assert.equal(winCoins, 1);
  assert.equal(firstPlayBonus, 3);
  assert.equal(capped, false);
  assert.equal(record.firstPlayClaimed, true);
  assert.equal(record.streak, 1);
  assert.equal(record.bestStreak, 1);
  assert.equal(record.plays, 1);
});

test('settleGameReward：首玩即输也发 3 且 streak=0', () => {
  const base = initialGameRecord('guess_number', TODAY, NOW);
  const { record, gained, winCoins, firstPlayBonus } = settleGameReward(
    base,
    'guess_number',
    false,
    TODAY,
    NOW
  );
  assert.equal(gained, 3);
  assert.equal(winCoins, 0);
  assert.equal(firstPlayBonus, 3);
  assert.equal(record.streak, 0);
  assert.equal(record.firstPlayClaimed, true);
});

test('settleGameReward：三连胜累计 streak/bestStreak 且首玩只发一次', () => {
  let record = initialGameRecord('guess_number', TODAY, NOW);
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const result = settleGameReward(record, 'guess_number', true, TODAY, NOW + i);
    record = result.record;
    total += result.gained;
  }
  assert.equal(record.streak, 3);
  assert.equal(record.bestStreak, 3);
  assert.equal(record.plays, 3);
  assert.equal(total, 4 + 1 + 1); // 首局 3+1，之后每局 1
  assert.equal(record.earnedToday, 3); // 首玩奖励不占日上限
});

test('settleGameReward：猜数字第 6 胜 gained=0、capped=true', () => {
  const base = {
    ...initialGameRecord('guess_number', TODAY, NOW),
    earnedToday: 5,
    firstPlayClaimed: true,
    streak: 5,
    bestStreak: 5,
  };
  const { record, gained, winCoins, capped } = settleGameReward(
    base,
    'guess_number',
    true,
    TODAY,
    NOW
  );
  assert.equal(gained, 0);
  assert.equal(winCoins, 0);
  assert.equal(capped, true);
  assert.equal(record.earnedToday, 5);
  assert.equal(record.streak, 6); // 金币截断不影响连胜累计
});

test('settleGameReward：room=2 时截断为 2', () => {
  const base = {
    ...initialGameRecord('gomoku', TODAY, NOW),
    earnedToday: 7,
    firstPlayClaimed: true,
  };
  const { gained, winCoins, capped } = settleGameReward(base, 'gomoku', true, TODAY, NOW);
  assert.equal(gained, 2);
  assert.equal(winCoins, 2);
  assert.equal(capped, true);
});

test('settleGameReward：跨日后上限恢复可再获', () => {
  const base = {
    ...initialGameRecord('guess_number', YESTERDAY, NOW),
    earnedToday: 5,
    firstPlayClaimed: true,
    streak: 5,
    bestStreak: 5,
  };
  const { record, gained } = settleGameReward(base, 'guess_number', true, TODAY, NOW);
  assert.equal(gained, 1);
  assert.equal(record.earnedToday, 1);
  assert.equal(record.streak, 6);
});

test('settleGameReward：判负清零 streak 保留 bestStreak', () => {
  const base = {
    ...initialGameRecord('guess_number', TODAY, NOW),
    firstPlayClaimed: true,
    streak: 4,
    bestStreak: 9,
  };
  const { record, gained } = settleGameReward(base, 'guess_number', false, TODAY, NOW);
  assert.equal(gained, 0);
  assert.equal(record.streak, 0);
  assert.equal(record.bestStreak, 9);
  assert.equal(record.plays, 1);
});

// ---- 主持人台词 ----

test('localHostLine：五类事件非空、无占位符残留', () => {
  const ctx = {
    gameId: 'guess_number',
    seed: 0,
    streak: 2,
    bestStreak: 5,
    detail: '还剩 3 次机会',
  };
  for (const event of ['start', 'near', 'win', 'lose', 'giveUp']) {
    const line = localHostLine(event, ctx);
    assert.ok(line.length > 0, `${event} 台词为空`);
    assert.ok(!line.includes('{'), `${event} 台词残留占位符：${line}`);
    assert.ok(!line.includes('}'), `${event} 台词残留占位符：${line}`);
  }
});

test('localHostLine：同 seed 确定性、不同 seed 覆盖池', () => {
  const ctx = {
    gameId: 'guess_number',
    streak: 1,
    bestStreak: 1,
    detail: '答案是 42',
  };
  assert.equal(localHostLine('win', { ...ctx, seed: 7 }), localHostLine('win', { ...ctx, seed: 7 }));
  const variants = new Set([0, 1, 2].map((seed) => localHostLine('win', { ...ctx, seed })));
  assert.equal(variants.size, 3); // win 池三条互不相同
});

test('buildHostPrompt：含 gameLabel 与上下文数值、system 含输出约束', () => {
  const { system, user } = buildHostPrompt('lose', {
    gameId: 'guess_number',
    seed: 0,
    streak: 3,
    bestStreak: 8,
    detail: '答案是 42',
  });
  assert.ok(system.includes('猜数字'));
  assert.ok(system.includes('简体中文'));
  assert.ok(system.includes('你'));
  assert.ok(user.includes('用完了机会'));
  assert.ok(user.includes('3'));
  assert.ok(user.includes('8'));
  assert.ok(user.includes('答案是 42'));
});

test('buildHostPrompt：detail 缺省时 user 不含现场情况行', () => {
  const { user } = buildHostPrompt('start', {
    gameId: 'guess_number',
    seed: 0,
    streak: 0,
    bestStreak: 0,
  });
  assert.ok(!user.includes('现场情况'));
  assert.ok(user.includes('对局开始'));
});
