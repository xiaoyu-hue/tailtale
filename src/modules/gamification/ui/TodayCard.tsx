import { useState } from 'react';
import { useStreak, useTodayCheckin, useTodayMinutes } from '../store';
import { checkIn } from '../service';
import { ECONOMY } from '../model';

interface TodayCardProps {
  onToast: (message: string) => void;
}

/** 今日阅读卡片：阅读分钟数、连续打卡天数、打卡入口（gamification 模块在首页的唯一 UI）。 */
export function TodayCard({ onToast }: TodayCardProps) {
  const minutes = useTodayMinutes();
  const streak = useStreak();
  const todayCheckin = useTodayCheckin();
  const [pending, setPending] = useState(false);

  const canCheckIn = !todayCheckin && minutes >= ECONOMY.CHECKIN_MIN_MINUTES;

  const handleCheckIn = async () => {
    if (pending) return;
    setPending(true);
    try {
      const result = await checkIn();
      if (result.ok) {
        onToast(`打卡成功 +${result.total} 金币，连续 ${result.streak} 天`);
      } else if (result.reason === 'already') {
        onToast('今天已经打过卡了');
      } else {
        onToast(`阅读满 ${ECONOMY.CHECKIN_MIN_MINUTES} 分钟才能打卡`);
      }
    } finally {
      setPending(false);
    }
  };

  const buttonLabel = todayCheckin
    ? `今日已打卡 +${ECONOMY.CHECKIN_COINS + todayCheckin.bonus}`
    : minutes >= ECONOMY.CHECKIN_MIN_MINUTES
      ? '打卡领金币'
      : `阅读 ${ECONOMY.CHECKIN_MIN_MINUTES} 分钟可打卡`;

  return (
    <section className="card today-card">
      <div className="today-card-main">
        <div className="today-card-minutes">
          <span className="today-card-number">{minutes}</span>
          <span className="today-card-unit">分钟</span>
        </div>
        <div className="today-card-meta">
          <div>今日阅读</div>
          <div className="today-card-streak">连续打卡 {streak} 天</div>
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary today-card-checkin"
        disabled={!canCheckIn || pending}
        onClick={() => void handleCheckIn()}
      >
        {buttonLabel}
      </button>
    </section>
  );
}
