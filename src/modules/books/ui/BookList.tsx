import type { Book } from '../model';
import { FORMAT_LABEL, STATUS_LABEL, nextStatus } from '../model';
import { changeStatus, deleteBookById, useBooks } from '../store';

interface BookListProps {
  onOpenBook: (bookId: string) => void;
  onToast: (message: string) => void;
}

/** TXT 按字数，EPUB / PDF 按体积 */
function formatSize(book: Book): string {
  if (book.format === 'txt') {
    if (book.size >= 10000) return `${(book.size / 10000).toFixed(1)} 万字`;
    return `${book.size} 字`;
  }
  if (book.size >= 1024 * 1024) return `${(book.size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(book.size / 1024))} KB`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '未读';
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 全部书籍列表：状态循环、删除、进入阅读。 */
export function BookList({ onOpenBook, onToast }: BookListProps) {
  const books = useBooks();

  const handleDelete = async (book: Book) => {
    const confirmed = window.confirm(
      `删除《${book.title}》？书籍文件与阅读进度将一并移除。`
    );
    if (!confirmed) return;
    try {
      await deleteBookById(book);
      onToast('已删除');
    } catch (error) {
      console.error('删除失败', error);
      onToast('删除失败，请重试');
    }
  };

  return (
    <>
      <h2 className="section-title" id="bookshelf">
        全部书籍（{books.length}）
      </h2>
      {books.length === 0 ? (
        <div className="empty-state">
          书架空空如也
          <br />
          导入一本 TXT / EPUB / PDF / FB2 / CBZ / MOBI / AZW3，开始你的第一段阅读时光
        </div>
      ) : (
        books.map((book) => (
          <div className="card" key={book.id}>
            <div className="book-row">
              <div className="book-row-head">
                <span className="book-title">{book.title}</span>
                <span className="chip chip-format">{FORMAT_LABEL[book.format]}</span>
                <span
                  className={`chip${
                    book.status === 'reading'
                      ? ' chip-reading'
                      : book.status === 'finished'
                        ? ' chip-finished'
                        : ''
                  }`}
                >
                  {STATUS_LABEL[book.status]}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.max(book.progress * 100, book.progress > 0 ? 2 : 0)}%` }}
                />
              </div>
              <div className="book-meta">
                {formatSize(book)} · 进度 {Math.round(book.progress * 100)}% ·{' '}
                {book.lastReadAt ? `最近阅读 ${formatDate(book.lastReadAt)}` : `导入于 ${formatDate(book.addedAt)}`}
              </div>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onOpenBook(book.id)}
                >
                  {book.progress > 0 ? '继续阅读' : '开始阅读'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const next = nextStatus(book.status);
                    changeStatus(book, next);
                    onToast(`已标记为「${STATUS_LABEL[next]}」`);
                  }}
                >
                  状态：{STATUS_LABEL[book.status]}
                </button>
                <button type="button" className="btn btn-danger" onClick={() => void handleDelete(book)}>
                  删除
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
