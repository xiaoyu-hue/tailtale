/**
 * games 模块四选一猜词出题单元测试（node:test，零新依赖）。
 * 运行：npm run test（tsconfig.test.json 编译 src 到 .test-dist/ 后执行本文件）。
 * 覆盖：题库数据完整性（主键唯一 / 答案唯一，干扰项取样依赖答案唯一）、
 * buildQuizRound 出题（选项互异含正确答案 / 同 seed 确定性 / 跨 seed 覆盖 /
 * 连续 seed 合法性 / 三游戏各自返回对应题库内容）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuizRound } from '../.test-dist/modules/games/model.js';
import { IDIOMS, PROVERBS, TEASERS } from '../.test-dist/modules/games/data/quizBank.js';

const QUIZ_GAMES = ['guess_idiom', 'guess_riddle', 'brain_teaser'];

// ---- 题库数据完整性 ----

test('题库：三库均非空且规模达到出题下限（>= 30 条）', () => {
  assert.ok(IDIOMS.length >= 30, `IDIOMS 仅 ${IDIOMS.length} 条`);
  assert.ok(PROVERBS.length >= 30, `PROVERBS 仅 ${PROVERBS.length} 条`);
  assert.ok(TEASERS.length >= 30, `TEASERS 仅 ${TEASERS.length} 条`);
});

test('题库：题目主键全库唯一（成语 / 歇后语前半 / 急转弯题干）', () => {
  const idiomKeys = new Set(IDIOMS.map((it) => it.idiom));
  assert.equal(idiomKeys.size, IDIOMS.length, '成语存在重复');
  const proverbKeys = new Set(PROVERBS.map((it) => it.front));
  assert.equal(proverbKeys.size, PROVERBS.length, '歇后语前半句存在重复');
  const teaserKeys = new Set(TEASERS.map((it) => it.q));
  assert.equal(teaserKeys.size, TEASERS.length, '脑筋急转弯题干存在重复');
});

test('题库：歇后语与急转弯的答案全库唯一（干扰项取样依赖，避免多解歧义）', () => {
  const backs = new Set(PROVERBS.map((it) => it.back));
  assert.equal(backs.size, PROVERBS.length, '歇后语后半句存在重复');
  const answers = new Set(TEASERS.map((it) => it.a));
  assert.equal(answers.size, TEASERS.length, '脑筋急转弯答案存在重复');
});

test('题库：条目字段非空', () => {
  for (const it of IDIOMS) assert.ok(it.idiom && it.meaning, '成语条目有空字段');
  for (const it of PROVERBS) assert.ok(it.front && it.back, '歇后语条目有空字段');
  for (const it of TEASERS) assert.ok(it.q && it.a, '急转弯条目有空字段');
});

// ---- buildQuizRound 出题 ----

test('buildQuizRound：4 个选项互异，且包含正确答案', () => {
  for (const gameId of QUIZ_GAMES) {
    for (let seed = 0; seed < 60; seed += 1) {
      const round = buildQuizRound(gameId, seed);
      assert.equal(round.options.length, 4, `${gameId}#${seed} 选项数不是 4`);
      assert.equal(new Set(round.options).size, 4, `${gameId}#${seed} 选项有重复`);
      assert.ok(round.options.includes(round.answer), `${gameId}#${seed} 选项不含正确答案`);
      assert.equal(round.options[round.answerIndex], round.answer, `${gameId}#${seed} 下标不指向答案`);
      assert.ok(round.prompt.length > 0, `${gameId}#${seed} 题干为空`);
    }
  }
});

test('buildQuizRound：同 seed 同结果（确定性，可复现对局）', () => {
  for (const gameId of QUIZ_GAMES) {
    const a = buildQuizRound(gameId, 12345);
    const b = buildQuizRound(gameId, 12345);
    assert.deepEqual(a, b);
  }
});

test('buildQuizRound：不同 seed 产生不同题目（轮换生效）', () => {
  const prompts = new Set();
  for (let seed = 0; seed < 200; seed += 1) {
    prompts.add(buildQuizRound('guess_idiom', seed).prompt);
  }
  assert.ok(prompts.size >= 20, `200 个 seed 仅覆盖 ${prompts.size} 道题`);
});

test('buildQuizRound：answerIndex 在 4 个位次上都有分布（非固定位）', () => {
  const slots = new Set();
  for (let seed = 0; seed < 80; seed += 1) {
    slots.add(buildQuizRound('brain_teaser', seed).answerIndex);
  }
  assert.equal(slots.size, 4, `answerIndex 仅覆盖 ${[...slots].sort()} 位`);
});

test('buildQuizRound：三游戏各自返回对应题库的 prompt 与 answer', () => {
  const idiom = buildQuizRound('guess_idiom', 7);
  assert.ok(IDIOMS.some((it) => it.meaning === idiom.prompt && it.idiom === idiom.answer));
  const proverb = buildQuizRound('guess_riddle', 7);
  assert.ok(PROVERBS.some((it) => it.front === proverb.prompt && it.back === proverb.answer));
  const teaser = buildQuizRound('brain_teaser', 7);
  assert.ok(TEASERS.some((it) => it.q === teaser.prompt && it.a === teaser.answer));
});

test('buildQuizRound：连续 300 个 seed 全部合法（含 0 与大数边界）', () => {
  const seeds = [0, 1, 2, 999_999, 2 ** 31 - 1, ...Array.from({ length: 300 }, (_, i) => i * 37)];
  for (const gameId of QUIZ_GAMES) {
    for (const seed of seeds) {
      const round = buildQuizRound(gameId, seed);
      assert.equal(new Set(round.options).size, 4, `${gameId}#${seed} 选项重复`);
      assert.equal(round.options[round.answerIndex], round.answer, `${gameId}#${seed} 下标错位`);
    }
  }
});
