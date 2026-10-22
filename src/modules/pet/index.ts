// pet 模块公开 API：宠物状态、互动动作与宠物 UI。
// S1 = 数据与逻辑层；S2 起 app 层经 commerce.ts 编排金币消费；S3 = 像素猫渲染与界面。
export {
  usePet,
  usePetLoaded,
  usePetMood,
  refreshPet,
  feedSnack,
  strokeCat,
  toggleSleep,
  acknowledgeBonds,
} from './store';
export {
  deriveMood,
  currentStage,
  SNACKS,
  PET_RULES,
  DAY_MS,
  HOUR_MS,
  STAGE_LABELS,
  MOOD_LABELS,
  PET_ACTION_HINTS,
} from './model';
export { CatStage } from './ui/CatStage';
export { StatBars } from './ui/StatBars';
export { SnackButtons } from './ui/SnackButtons';
export type { Pet, PetMood, PetStage, PetRejectReason, PetActionResult, SnackId, SnackEffect } from './model';
