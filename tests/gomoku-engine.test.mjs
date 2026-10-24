/**
 * vendored 五子棋引擎单元测试（node:test，零新依赖）。
 * 运行：npm run test（tsconfig.test.json 编译 src 到 .test-dist/ 后执行本文件）。
 * 覆盖：棋盘不可变操作、四方向胜负判定、获胜连线、AI 落子合法性与
 * 关键攻防行为（活四必堵、自己成五必胜、有空位可下）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLACK,
  BOARD_SIZE,
  EMPTY,
  WHITE,
  checkWin,
  createBoard,
  getNearbyCells,
  getWinLine,
  isFull,
  isValidMove,
  placeStone,
} from '../.test-dist/vendor/gomoku/gomoku.js';
import { getAIMove } from '../.test-dist/vendor/gomoku/ai.js';

/** 依次落子（便捷构造，忽略返回的新棋盘链式传递）。 */
function boardFrom(moves) {
  let board = createBoard();
  for (const [r, c, p] of moves) board = placeStone(board, r, c, p);
  return board;
}

// ---- 棋盘基础 ----

test('createBoard：15×15 全空', () => {
  const board = createBoard();
  assert.equal(board.length, BOARD_SIZE);
  assert.ok(board.every((row) => row.length === BOARD_SIZE && row.every((v) => v === EMPTY)));
});

test('placeStone：不可变——原棋盘不变，返回新棋盘', () => {
  const board = createBoard();
  const next = placeStone(board, 7, 7, BLACK);
  assert.equal(board[7][7], EMPTY, '原棋盘被修改');
  assert.equal(next[7][7], BLACK);
  assert.notEqual(next, board);
});

test('isValidMove：越界与占用拒绝，空位接受', () => {
  const board = placeStone(createBoard(), 0, 0, BLACK);
  assert.equal(isValidMove(board, -1, 0), false);
  assert.equal(isValidMove(board, 0, BOARD_SIZE), false);
  assert.equal(isValidMove(board, 0, 0), false);
  assert.equal(isValidMove(board, 14, 14), true);
});

test('isFull：仅当满盘为真', () => {
  let board = createBoard();
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) board = placeStone(board, r, c, BLACK);
  }
  assert.equal(isFull(board), true);
  assert.equal(isFull(createBoard()), false);
});

test('getNearbyCells：空棋盘返回中心点', () => {
  const cells = getNearbyCells(createBoard());
  assert.deepEqual(cells, [[7, 7]]);
});

// ---- 胜负判定 ----

test('checkWin：横 / 竖 / 撇 / 捺四方向成五', () => {
  const cases = [
    { moves: [[7, 5], [7, 6], [7, 7], [7, 8], [7, 9]], at: [7, 9] }, // 横
    { moves: [[5, 7], [6, 7], [7, 7], [8, 7], [9, 7]], at: [9, 7] }, // 竖
    { moves: [[5, 5], [6, 6], [7, 7], [8, 8], [9, 9]], at: [9, 9] }, // 捺 ↘
    { moves: [[5, 9], [6, 8], [7, 7], [8, 6], [9, 5]], at: [9, 5] }, // 撇 ↙
  ];
  for (const { moves, at } of cases) {
    let board = createBoard();
    for (const [r, c] of moves) board = placeStone(board, r, c, BLACK);
    assert.equal(checkWin(board, at[0], at[1], BLACK), true, `${at} 应成五`);
    assert.equal(checkWin(board, at[0], at[1], WHITE), false, '对方子不算成五');
  }
});

test('checkWin：四连不成胜；黑成五时白同点不判胜', () => {
  let board = createBoard();
  for (const [r, c] of [[7, 5], [7, 6], [7, 7], [7, 8]]) board = placeStone(board, r, c, BLACK);
  assert.equal(checkWin(board, 7, 8, BLACK), false);
});

test('getWinLine：返回 5 个连线格；未胜返回 null', () => {
  let board = createBoard();
  for (const [r, c] of [[7, 5], [7, 6], [7, 7], [7, 8], [7, 9], [3, 3]]) board = placeStone(board, r, c, BLACK);
  const line = getWinLine(board, 7, 9, BLACK);
  assert.ok(line);
  assert.equal(line.length, 5);
  assert.deepEqual([...line].sort(), [[7, 5], [7, 6], [7, 7], [7, 8], [7, 9]]);
  assert.equal(getWinLine(board, 3, 3, BLACK), null);
});

test('checkWin：长连（六连）也算胜（无禁手规则，口径从简）', () => {
  let board = createBoard();
  for (const [r, c] of [[7, 4], [7, 5], [7, 6], [7, 7], [7, 8], [7, 9]]) board = placeStone(board, r, c, BLACK);
  assert.equal(checkWin(board, 7, 9, BLACK), true);
});

// ---- AI 行为 ----

test('getAIMove：返回合法空位（三档难度 × 空半盘）', () => {
  const board = boardFrom([
    [7, 7, BLACK],
    [7, 8, WHITE],
    [8, 7, BLACK],
    [6, 8, WHITE],
  ]);
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const [r, c] = getAIMove(board, WHITE, difficulty);
    assert.equal(isValidMove(board, r, c), true, `${difficulty} 落下非法位置`);
  }
});

test('getAIMove(hard)：必须堵玩家的活四', () => {
  // 黑横四（7,5)-(7,8)，两端（7,4）(7,9) 皆空——AI 白必须堵其中一端
  const board = boardFrom([
    [7, 5, BLACK],
    [7, 6, BLACK],
    [7, 7, BLACK],
    [7, 8, BLACK],
    [7, 0, WHITE],
    [8, 8, WHITE],
  ]);
  const [r, c] = getAIMove(board, WHITE, 'hard');
  assert.ok(
    (r === 7 && (c === 4 || c === 9)),
    `AI 未堵活四，落在了 (${r},${c})`
  );
});

test('getAIMove(hard)：自己有四连时必成五取胜', () => {
  // 白横四 (7,5)-(7,8)，黑无即胜威胁——AI 白应下 (7,4) 或 (7,9) 成五
  const board = boardFrom([
    [7, 5, WHITE],
    [7, 6, WHITE],
    [7, 7, WHITE],
    [7, 8, WHITE],
    [8, 0, BLACK],
    [9, 1, BLACK],
  ]);
  const [r, c] = getAIMove(board, WHITE, 'hard');
  const next = placeStone(board, r, c, WHITE);
  assert.equal(checkWin(next, r, c, WHITE), true, `AI 未在 (${r},${c}) 成五`);
});
