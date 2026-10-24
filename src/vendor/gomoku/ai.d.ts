// vendored sen-ltd/gomoku-ai 的类型声明（MIT，Copyright (c) 2026 SEN LLC）。
// 随 src/vendor/gomoku/ai.js 更新而同步维护（改 API 必须同步改这里）。
import type { Board } from './gomoku.js';

/** AI 难度：easy=随机nearby / medium=minimax 深度 2 / hard=深度 4 + alpha-beta */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** 返回 AI 下一步的 [row, col]（同步计算，UI 侧需自行让出主线程） */
export function getAIMove(board: Board, player: 1 | 2, difficulty?: Difficulty): [number, number];
