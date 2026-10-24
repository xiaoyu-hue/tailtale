// vendored sen-ltd/gomoku-ai 的类型声明（MIT，Copyright (c) 2026 SEN LLC）。
// 随 src/vendor/gomoku/gomoku.js 更新而同步维护（改 API 必须同步改这里）。

export const BOARD_SIZE: 15;
export const EMPTY: 0;
export const BLACK: 1;
export const WHITE: 2;

/** 棋子：空 / 黑 / 白 */
export type Stone = 0 | 1 | 2;
/** 棋盘：15×15 二维数组（不可变，落子返回新棋盘） */
export type Board = Stone[][];
/** 坐标 [row, col] */
export type Move = [number, number];

export function createBoard(): Board;
export function placeStone(board: Board, row: number, col: number, player: 1 | 2): Board;
export function isValidMove(board: Board, row: number, col: number): boolean;
/** 假设 (row, col) 已落子，判断该子是否成五 */
export function checkWin(board: Board, row: number, col: number, player: 1 | 2): boolean;
/** 返回获胜连线的格子数组；未获胜返回 null */
export function getWinLine(board: Board, row: number, col: number, player: 1 | 2): Move[] | null;
export function isFull(board: Board): boolean;
export function getEmptyCells(board: Board): Move[];
/** 已有棋子半径 radius 内的空位（AI 搜索剪枝用）；空棋盘返回中心点 */
export function getNearbyCells(board: Board, radius?: number): Move[];
