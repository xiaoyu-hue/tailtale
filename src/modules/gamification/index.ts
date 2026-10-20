// gamification 模块公开 API：阅读计时、金币经济、打卡
export {
  useCoins,
  useXp,
  useTodayMinutes,
  useStreak,
  useTodayCheckin,
  useCheckinDates,
  refreshGamification,
} from './store';
export { startReading, stopReading } from './service';
export { checkIn as checkInToday } from './service';
export type { CheckinResult } from './service';
export { TodayCard } from './ui/TodayCard';
