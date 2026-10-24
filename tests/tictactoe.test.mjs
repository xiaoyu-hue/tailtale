/**
 * 井字棋模型与 AI 单元测试（node:test，零新依赖）。
 * 运行：npm run test（tsconfig.test.json 编译 src 到 .test-dist/ 后执行本文件）。
 * 覆盖：棋盘不可变操作、八线胜负判定、AI 即时胜 / 必堵威胁、
 * 核心保证——穷举玩家全部先手策略，hard 难度永不被胜（只能胜或平）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI,
  EMPTY,
  LINES,
  PLAYER,
  bestMove,
  createBoard,
  emptyCells,
  findWin,
  isFull,
  isValidMove,
  placeMark,
} from '../.test-dist/modules/games/tictactoe.js';

/** 便捷构造：[[下标, 棋子], ...] */
function boardFrom(moves) {
  let board = createBoard();
  for (const [i, mark] of moves) board = placeMark(board, i, mark);
  return board;
}

// ---- 棋盘基础 ----

test('createBoard：9 格全空', () => {
  const board = createBoard();
  assert.equal(board.length, 9);
  assert.ok(board.every((c) => c === EMPTY));
});

test('placeMark：不可变——原棋盘不变', () => {
  const board = createBoard();
  const next = placeMark(board, 4, PLAYER);
  assert.equal(board[4], EMPTY);
  assert.equal(next[4], PLAYER);
  assert.notEqual(next, board);
});

test('isValidMove：越界与占用拒绝', () => {
  const board = placeMark(createBoard(), 0, PLAYER);
  assert.equal(isValidMove(board, -1), false);
  assert.equal(isValidMove(board, 9), false);
  assert.equal(isValidMove(board, 0), false);
  assert.equal(isValidMove(board, 4), true);
});

test('isFull / emptyCells', () => {
  assert.equal(isFull(createBoard()), false);
  assert.deepEqual(emptyCells(createBoard()), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const full = placeMark(boardFrom([[0, PLAYER], [1, AI], [2, PLAYER], [3, AI], [4, PLAYER], [5, AI], [6, AI], [7, PLAYER], [8, AI]]), 8, AI);
  assert.equal(isFull(full), true);
  assert.deepEqual(emptyCells(full), []);
});

// ---- 胜负判定 ----

test('findWin：八条线全部识别（横三 / 竖三 / 对角二）', () => {
  for (const line of LINES) {
    const board = boardFrom(line.map((i) => [i, PLAYER]));
    const win = findWin(board);
    assert.ok(win, `线 ${line} 未识别`);
    assert.equal(win.winner, PLAYER);
  }
});

test('findWin：两连或斜角不成立时返回 null', () => {
  assert.equal(findWin(boardFrom([[0, PLAYER], [1, PLAYER]])), null);
  assert.equal(findWin(boardFrom([[0, PLAYER], [4, AI], [8, PLAYER]])), null);
});

// ---- AI 行为 ----

test('bestMove(hard)：有即时胜着必成三', () => {
  // AI 占 0、1，下 2 成横三
  const board = boardFrom([
    [0, AI],
    [1, AI],
    [3, PLAYER],
    [4, PLAYER],
  ]);
  assert.equal(bestMove(board, 'hard'), 2);
});

test('bestMove(hard)：玩家成三威胁必堵', () => {
  // 玩家占 0、1（威胁 2 成横三）；AI 占 4、8 无即胜——必须堵 2
  const board = boardFrom([
    [0, PLAYER],
    [1, PLAYER],
    [4, AI],
    [8, AI],
  ]);
  assert.equal(bestMove(board, 'hard'), 2);
});

test('bestMove(hard)：无威胁时抢占中心（先手最优）', () => {
  assert.equal(bestMove(createBoard(), 'hard'), 4);
});

test('bestMove(easy)：返回合法空格', () => {
  const board = boardFrom([
    [0, PLAYER],
    [4, AI],
  ]);
  // rng 固定为 0 → 取第一个空格
  assert.equal(bestMove(board, 'easy', () => 0), 1);
});

test('bestMove：棋盘已满返回 -1', () => {
  const board = boardFrom([
    [0, PLAYER],
    [1, AI],
    [2, PLAYER],
    [3, AI],
    [4, PLAYER],
    [5, AI],
    [6, AI],
    [7, PLAYER],
    [8, AI],
  ]);
  assert.equal(bestMove(board, 'hard'), -1);
});

test('不可战胜性：穷举玩家全部先手策略，hard 永不被胜（只能 AI 胜或平）', () => {
  // 枚举所有对局：玩家每手任意合法走法，AI 固定 hard。
  let aiWins = 0;
  let draws = 0;
  let total = 0;

  const play = (board, turn) => {
    const win = findWin(board);
    if (win) {
      total += 1;
      if (win.winner === AI) aiWins += 1;
      else throw new Error(`AI 被玩家战胜！board=${board.join('')}`);
      return;
    }
    if (isFull(board)) {
      total += 1;
      draws += 1;
      return;
    }
    if (turn === PLAYER) {
      for (const i of emptyCells(board)) play(placeMark(board, i, PLAYER), AI);
    } else {
      const i = bestMove(board, 'hard');
      play(placeMark(board, i, AI), PLAYER);
    }
  };
  play(createBoard(), PLAYER);

  assert.ok(total > 0, '未枚举到任何对局');
  assert.ok(aiWins > 0, 'AI 从未获胜（ minimax 可疑）');
  assert.ok(draws > 0, '从未出现平局（ minimax 可疑）');
});
