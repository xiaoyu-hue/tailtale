/**
 * 井字棋领域模型与 AI（批次 2 第五个游戏）。
 * 纯函数、零依赖，可独立编译单测（tests/tictactoe.test.mjs）。
 *
 * 实现说明（取舍）：五子棋 vendored 了 sen-ltd/gomoku-ai（评估函数需调参，
 * 有真实复用价值）；井字棋的 minimax 是唯一最优解的标准算法（状态空间
 * 仅 3^9，行为完全确定），调研过的开源候选全部与 DOM / Canvas 深度耦合，
 * vendored 需剥壳改写、失去「整文件替换」意义，故自研教科书标准实现，
 * 并以「不可战胜」穷举单测锁死行为（详见测试文件）。
 */

/** 格子：空 / 玩家 X / AI O（玩家先手）。 */
export const EMPTY = 0;
export const PLAYER = 1;
export const AI = 2;
export type Cell = 0 | 1 | 2;
export type Board = Cell[];

/** 八条获胜线（下标）。 */
export const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** AI 难度：easy=随机；medium=一半概率最优；hard=完美 minimax（不可战胜）。 */
export type Difficulty = 'easy' | 'medium' | 'hard';

export function createBoard(): Board {
  return [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
}

/** 落子合法性：下标在界内且为空。 */
export function isValidMove(board: Board, index: number): boolean {
  return index >= 0 && index < board.length && board[index] === EMPTY;
}

/** 返回新棋盘（不可变）。 */
export function placeMark(board: Board, index: number, mark: 1 | 2): Board {
  const next = board.slice();
  next[index] = mark;
  return next;
}

/** 当前是否有人成三；返回赢家与连线（无人成三返回 null）。 */
export function findWin(board: Board): { winner: 1 | 2; line: readonly [number, number, number] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a] as 1 | 2, line };
    }
  }
  return null;
}

/** 是否下满（无空格）。 */
export function isFull(board: Board): boolean {
  return board.every((cell) => cell !== EMPTY);
}

/** 所有空格下标。 */
export function emptyCells(board: Board): number[] {
  return board.reduce<number[]>((acc, cell, i) => (cell === EMPTY ? [...acc, i] : acc), []);
}

/** 终局计分：AI 胜 +10-depth（快胜优先），玩家胜 -10+depth，平局 0。 */
function scoreTerminal(board: Board, depth: number): number | null {
  const win = findWin(board);
  if (win) return win.winner === AI ? 10 - depth : depth - 10;
  return isFull(board) ? 0 : null;
}

/** minimax + alpha-beta（AI 为最大化方；行为确定，无随机性）。 */
function minimax(board: Board, depth: number, isMax: boolean, alpha: number, beta: number): number {
  const terminal = scoreTerminal(board, depth);
  if (terminal !== null) return terminal;
  const maximizing = isMax ? AI : PLAYER;
  let best = isMax ? -Infinity : Infinity;
  for (const i of emptyCells(board)) {
    const score = minimax(placeMark(board, i, maximizing), depth + 1, !isMax, alpha, beta);
    if (isMax) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/** 同分着法偏好序：中心 > 角 > 边（完美对弈下所有首着同分，按棋理取中心）。 */
const PREFERENCE = [4, 0, 2, 6, 8, 1, 3, 5, 7];

/** 最优着法（完美 minimax；同分时按 PREFERENCE 取先，保证确定性）。 */
function perfectMove(board: Board): number {
  const cells = new Set(emptyCells(board));
  let bestScore = -Infinity;
  let bestIndex = emptyCells(board)[0];
  for (const i of PREFERENCE) {
    if (!cells.has(i)) continue;
    const score = minimax(placeMark(board, i, AI), 1, false, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * AI 着法：easy 随机 / medium 一半概率最优 / hard 完美 minimax。
 * 返回空格下标（棋盘已满时返回 -1，调用方应先判终局）。
 */
export function bestMove(board: Board, difficulty: Difficulty, rng: () => number = Math.random): number {
  const cells = emptyCells(board);
  if (cells.length === 0) return -1;
  if (difficulty === 'easy') return cells[Math.floor(rng() * cells.length) % cells.length];
  if (difficulty === 'medium' && rng() < 0.5) return cells[Math.floor(rng() * cells.length) % cells.length];
  return perfectMove(board);
}
