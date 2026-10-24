/**
 * games 模块局后 AI 点评与追问单元测试（node:test，零新依赖）。
 * 运行：npm run test（tsconfig.test.json 编译 src 到 .test-dist/ 后执行本文件）。
 * 覆盖：buildReviewPrompt / buildFollowUpPrompt 的 prompt 构造（人设约束 /
 * 对局事实入 prompt / 历史拼接 / 确定性）与 suggestFollowUps 推荐追问。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFollowUpPrompt,
  buildReviewPrompt,
  suggestFollowUps,
} from '../.test-dist/modules/games/model.js';

const SUMMARY_WON = { gameId: 'guess_number', outcome: 'won', detail: '用了 4 次猜中', coins: 4 };
const SUMMARY_LOST = { gameId: 'gomoku', outcome: 'lost', detail: 'AI 先成五，输了', coins: 0 };
const SUMMARY_DRAW = { gameId: 'tictactoe', outcome: 'draw', detail: '棋盘下满，无人成三', coins: 0 };

// ---- buildReviewPrompt ----

test('buildReviewPrompt：system 定人设与输出约束（游戏名 / 简体中文 / 「你」/ 100 字 / 不编造）', () => {
  const { system } = buildReviewPrompt(SUMMARY_WON);
  assert.ok(system.includes('猜数字'), 'system 缺少游戏名');
  assert.ok(system.includes('简体中文'), 'system 缺少语言约束');
  assert.ok(system.includes('「你」'), 'system 缺少称呼约束');
  assert.ok(system.includes('100 字'), 'system 缺少篇幅约束');
  assert.ok(system.includes('不得编造'), 'system 缺少禁止编造约束');
});

test('buildReviewPrompt：user 含对局结果、现场事实与金币情况', () => {
  const { user } = buildReviewPrompt(SUMMARY_WON);
  assert.ok(user.includes('玩家获胜'), 'user 缺少结果描述');
  assert.ok(user.includes('用了 4 次猜中'), 'user 缺少现场事实');
  assert.ok(user.includes('本局获得 4 金币'), 'user 缺少金币信息');
  const lost = buildReviewPrompt(SUMMARY_LOST).user;
  assert.ok(lost.includes('玩家落败'), 'user 结果描述错误');
  assert.ok(lost.includes('本局没有获得金币'), '零金币描述缺失');
});

test('buildReviewPrompt：三种 outcome 各有对应事件描述', () => {
  assert.ok(buildReviewPrompt(SUMMARY_WON).user.includes('玩家获胜'));
  assert.ok(buildReviewPrompt(SUMMARY_LOST).user.includes('玩家落败'));
  assert.ok(buildReviewPrompt(SUMMARY_DRAW).user.includes('平局'));
});

test('buildReviewPrompt：同 summary 同结果（确定性）', () => {
  assert.deepEqual(buildReviewPrompt(SUMMARY_WON), buildReviewPrompt(SUMMARY_WON));
});

test('buildReviewPrompt：detail 为空串不抛错且仍带现场情况行', () => {
  const { user } = buildReviewPrompt({ ...SUMMARY_WON, detail: '' });
  assert.ok(user.includes('现场情况：'), 'detail 为空时现场情况行丢失');
});

// ---- buildFollowUpPrompt ----

test('buildFollowUpPrompt：user 含对局事实与当前问题', () => {
  const { user } = buildFollowUpPrompt(SUMMARY_WON, [], '这局我哪里做得好？');
  assert.ok(user.includes('用了 4 次猜中'), 'user 缺少现场事实');
  assert.ok(user.includes('当前问题：这局我哪里做得好？'), 'user 缺少当前问题');
});

test('buildFollowUpPrompt：无历史时不出现对话历史段', () => {
  const { user } = buildFollowUpPrompt(SUMMARY_WON, [], '问题');
  assert.ok(!user.includes('对话历史'), '空历史不应出现对话历史段');
});

test('buildFollowUpPrompt：有历史时按顺序拼接全部轮次', () => {
  const history = [
    { role: 'user', content: '第一问' },
    { role: 'assistant', content: '第一答' },
    { role: 'user', content: '第二问' },
  ];
  const { user } = buildFollowUpPrompt(SUMMARY_WON, history, '第三问');
  assert.ok(user.includes('对话历史：'), '缺少对话历史段头');
  assert.ok(user.includes('玩家：第一问'), '缺少用户轮次');
  assert.ok(user.includes('主持人：第一答'), '缺少助手轮次');
  assert.ok(user.includes('玩家：第二问'), '缺少第二轮用户轮次');
  assert.ok(user.includes('当前问题：第三问'), '当前问题缺失');
  assert.ok(user.indexOf('第一问') < user.indexOf('第二问'), '历史顺序错乱');
  assert.ok(user.indexOf('第二问') < user.indexOf('第三问'), '历史与当前问题顺序错乱');
});

test('buildFollowUpPrompt：system 含追问口径（150 字 / 只聊对局）', () => {
  const { system } = buildFollowUpPrompt(SUMMARY_WON, [], '问题');
  assert.ok(system.includes('150 字'), 'system 缺少篇幅约束');
  assert.ok(system.includes('只聊这局对局'), 'system 缺少话题边界约束');
});

test('buildFollowUpPrompt：同输入同结果（确定性）', () => {
  const history = [{ role: 'user', content: '问' }];
  assert.deepEqual(
    buildFollowUpPrompt(SUMMARY_LOST, history, '再问'),
    buildFollowUpPrompt(SUMMARY_LOST, history, '再问')
  );
});

// ---- suggestFollowUps ----

test('suggestFollowUps：三种结果各返回 3 条互异非空推荐', () => {
  for (const summary of [SUMMARY_WON, SUMMARY_LOST, SUMMARY_DRAW]) {
    const list = suggestFollowUps(summary);
    assert.equal(list.length, 3, `${summary.outcome} 推荐数不是 3`);
    assert.equal(new Set(list).size, 3, `${summary.outcome} 推荐存在重复`);
    for (const q of list) assert.ok(q.trim().length > 0, '存在空推荐');
  }
});

test('suggestFollowUps：不同结果的推荐池不同', () => {
  const won = suggestFollowUps(SUMMARY_WON);
  const lost = suggestFollowUps(SUMMARY_LOST);
  const draw = suggestFollowUps(SUMMARY_DRAW);
  assert.ok(won.some((q) => !lost.includes(q)), 'won 与 lost 推荐池相同');
  assert.ok(draw.some((q) => !won.includes(q) && !lost.includes(q)), 'draw 推荐无独立内容');
});

test('suggestFollowUps：返回新数组（改动不污染常量池）', () => {
  const a = suggestFollowUps(SUMMARY_WON);
  a.push('污染');
  const b = suggestFollowUps(SUMMARY_WON);
  assert.equal(b.length, 3, '常量池被污染');
});

test('suggestFollowUps：确定性（同 summary 同结果）', () => {
  assert.deepEqual(suggestFollowUps(SUMMARY_LOST), suggestFollowUps(SUMMARY_LOST));
});
