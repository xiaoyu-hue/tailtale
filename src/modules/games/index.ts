/**
 * games 模块公开 API：游戏目录、对局记录、金币结算、主持人台词。
 * 其他模块与应用层只准经本文件依赖 games（架构设计 §3 单向依赖）。
 * 批次 1：猜数字 + AI 主持人双模式；后续游戏只加 ui 对局组件与经济条目。
 */

// 状态与动作
export {
  refreshGames,
  useGameRecord,
  useGamesLoaded,
  useHostMode,
  setHostMode,
  settleGameRound,
} from './store';

// 副作用边界（主持人台词降级链）
export { fetchHostLine } from './service';
export type { SettleResult, HostLine } from './service';

// UI（游戏主页；对局经 Sheet 展开）
export { GamesView } from './ui/GamesView';

// 领域模型（数值权威来源：PRD §3.1.1）
export { GAME_LABELS, GAME_ECONOMY, FIRST_PLAY_COINS } from './model';
export type {
  GameId,
  GameRecord,
  GameSettlement,
  GameEconomyRule,
  HostEvent,
  HostContext,
  HostMode,
} from './model';
