import { useMemo, useState } from 'react';
import { useCheckinDates } from '../../modules/gamification';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 打卡日历卡：当月热力图（GitHub 贡献图样式），可翻看历史月份，未来月份不可翻。 */
export function CheckinCalendar() {
  const checkinDates = useCheckinDates();
  const [monthOffset, setMonthOffset] = useState(0);

  const checkedSet = useMemo(() => new Set(checkinDates), [checkinDates]);

  const view = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = first.getFullYear();
    const month = first.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = first.getDay(); // 周日为一周起点
    const cells: Array<{ day: number; key: string } | null> = [
      ...Array.from({ length: leadingBlanks }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        return { day, key: dateKey(year, month, day) };
      }),
    ];
    return { year, month, cells };
  }, [monthOffset]);

  const todayKey = useMemo(() => {
    const now = new Date();
    return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  return (
    <section className="card calendar-card" id="checkin-calendar">
      <div className="calendar-head">
        <h2 style={{ margin: 0, fontSize: 17 }}>打卡日历</h2>
        <div className="calendar-nav">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMonthOffset((offset) => offset - 1)}
            aria-label="上个月"
          >
            ‹
          </button>
          <span className="calendar-title">
            {view.year} 年 {view.month + 1} 月
          </span>
          <button
            type="button"
            className="icon-btn"
            disabled={monthOffset >= 0}
            onClick={() => setMonthOffset((offset) => offset + 1)}
            aria-label="下个月"
          >
            ›
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((weekday) => (
          <div className="calendar-weekday" key={weekday}>
            {weekday}
          </div>
        ))}
        {view.cells.map((cell, index) =>
          cell === null ? (
            <div className="calendar-cell blank" key={`blank-${index}`} />
          ) : (
            <div
              key={cell.key}
              className={`calendar-cell${checkedSet.has(cell.key) ? ' checked' : ''}${
                cell.key === todayKey ? ' today' : ''
              }`}
            >
              {cell.day}
            </div>
          )
        )}
      </div>

      <div className="calendar-legend">
        <span className="calendar-swatch checked" /> 已打卡
        <span className="calendar-swatch today-swatch" /> 今天
      </div>
    </section>
  );
}
