import { useRecentBook } from '../store';

interface ContinueReadingProps {
  onOpenBook: (bookId: string) => void;
}

/** 继续阅读卡片：展示最近阅读的书与总进度。 */
export function ContinueReading({ onOpenBook }: ContinueReadingProps) {
  const recentBook = useRecentBook();
  if (!recentBook) return null;

  return (
    <>
      <h2 className="section-title">继续阅读</h2>
      <div className="card">
        <div className="book-row-head">
          <span className="book-title">{recentBook.title}</span>
          <span className="book-meta">{Math.round(recentBook.progress * 100)}%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.max(recentBook.progress * 100, 2)}%` }}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => onOpenBook(recentBook.id)}
        >
          继续阅读
        </button>
      </div>
    </>
  );
}
