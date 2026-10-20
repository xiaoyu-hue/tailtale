import { useBooks } from '../../modules/books';
import { useCheckinDates, useCoins, useStreak, useXp } from '../../modules/gamification';

/** 阅读统计卡：累计数据总览（我的页）。数据全部来自既有 store，无需额外采集。 */
export function StatsCard() {
  const books = useBooks();
  const xp = useXp();
  const coins = useCoins();
  const streak = useStreak();
  const checkinDates = useCheckinDates();
  const finished = books.filter((book) => book.status === 'finished').length;
  const reading = books.filter((book) => book.status === 'reading').length;

  const items: Array<{ label: string; value: string }> = [
    { label: '累计阅读', value: `${xp} 分钟` },
    { label: '当前金币', value: String(coins) },
    { label: '读完书籍', value: `${finished} 本` },
    { label: '打卡天数', value: `${checkinDates.length} 天` },
    { label: '连续打卡', value: `${streak} 天` },
    { label: '在读书籍', value: `${reading} 本` },
  ];

  return (
    <section className="card stats-card" id="stats">
      <h2 style={{ margin: '0 0 10px', fontSize: 17 }}>阅读统计</h2>
      <div className="stats-grid">
        {items.map((item) => (
          <div className="stat-cell" key={item.label}>
            <div className="stat-value">{item.value}</div>
            <div className="stat-label">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
