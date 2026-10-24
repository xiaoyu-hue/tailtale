/**
 * ai 模块公开 API：其他模块与应用层只准经本文件依赖 ai（架构设计 §3 单向依赖）。
 * M5「AI 解读书」：BYOK 密钥配置、全书大纲/摘要、针对本书提问。
 */

// 配置状态与动作
export {
  useAiConfig,
  useAiConfigured,
  patchAiConfig,
  resetAiConfig,
  getCachedOutline,
  runOutline,
  ask,
  chatOnce,
  prepareExplain,
} from './store';
export type { AiState, CachedOutline } from './store';

// 领域模型与纯函数
export {
  DEEPSEEK_PRESET,
  REFERENCE_PRICE,
  GROUP_RULES,
  defaultAiConfig,
  isAiConfigured,
  AiError,
  describeAiError,
} from './model';
export type { AiConfig, AiErrorInfo, AiErrorCode, CostEstimate } from './model';

// UI（阅读器入口抽屉 / 设置卡片 / 费用预估弹窗）
export { AiDrawer } from './ui/AiDrawer';
export { AiSettingsSection } from './ui/AiSettingsSection';
export { CostDialog } from './ui/CostDialog';
