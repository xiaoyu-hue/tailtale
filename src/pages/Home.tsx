import { useRef, useState } from 'react';
import type { Book, BookStatus } from '../types';
import type { TabKey } from '../components/BottomNav';
import { importTxtFile, removeBook } from '../lib/books';

interface HomeProps {
  books: Book[];
  onImported: () => void;
  onRemoved: () => void;
  onOpenBook: (bookId: string) => void;
  onStatusChange: (book: Book, status: BookStatus) => void;
  onNavigateTab: (tab: TabKey) => void;
}

const STATUS_LABEL: Record<BookStatus, string> = {
  want: '想读',
  reading: '在读',
  finished: '读完',
};

const STATUS_ORDER: BookStatus[] = ['want', 'reading', 'finished'];

interface Feature {
  label: string;
  icon: JSX.Element;
  /** 里程碑编号，缺省表示已可用 */
  milestone?: string;
  action?: 'recent' | 'profile';
}

const FEATURES: Feature[] = [
  {
    label: '书架',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="7" height="16" rx="1" />
        <rect x="14" y="4" width="7" height="16" rx="1" />
      </svg>
    ),
  },
  {
    label: '继续阅读',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 6.5C10.5 5 8.5 4.5 4 4.5v14c4.5 0 6.5.5 8 2 1.5-1.5 3.5-2 8-2v-14c-4.5 0-6.5.5-8 2Z" />
        <path d="M12 6.5v14" />
      </svg>
    ),
    action: 'recent',
  },
  { label: '宠物', milestone: 'M3', icon: <PawIcon /> },
  { label: '商店', milestone: 'M3', icon: <BagIcon /> },
  {
    label: 'AI 解读书',
    milestone: 'M5',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
        <path d="M18.5 15.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z" />
      </svg>
    ),
  },
  {
    label: '工具箱',
    milestone: 'M4',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: '打卡日历',
    milestone: 'M2',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="16" rx="2" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    label: '阅读统计',
    milestone: 'M2',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20V12M10 20V6M16 20v-6M22 20H2" />
      </svg>
    ),
  },
  {
    label: '数据备份',
    milestone: 'M6',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5v11m0 0-4-4m4 4 4-4" />
        <path d="M4 17v2.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V17" />
      </svg>
    ),
  },
  {
    label: '公版书库',
    milestone: 'M7',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    label: '主题皮肤',
    milestone: 'M6',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="10" cy="15" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: '关于',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 11v5M12 8v.5" />
      </svg>
    ),
    action: 'profile',
  },
];

function PawIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <ellipse cx="7" cy="8.5" rx="2.1" ry="2.6" />
      <ellipse cx="17" cy="8.5" rx="2.1" ry="2.6" />
      <ellipse cx="4.6" cy="14" rx="2" ry="2.4" />
      <ellipse cx="19.4" cy="14" rx="2" ry="2.4" />
      <ellipse cx="12" cy="15.5" rx="4" ry="3.6" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1.2 12.2a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4L5 8Z" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
    </svg>
  );
}

function formatSize(chars: number): string {
  if (chars >= 10000) return `${(chars / 10000).toFixed(1)} 万字`;
  return `${chars} 字`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '未读';
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function Home({
  books,
  onImported,
  onRemoved,
  onOpenBook,
  onStatusChange,
  onNavigateTab,
}: HomeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number>(0);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  };

  const recentBook = books.find((book) => book.lastReadAt > 0);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const txtFiles = Array.from(files).filter((file) => /\.txt$/i.test(file.name));
    if (txtFiles.length === 0) {
      showToast('目前仅支持 TXT（EPUB / PDF 将于 M2 接入）');
      return;
    }
    let success = 0;
    for (const file of txtFiles) {
      try {
        await importTxtFile(file);
        success += 1;
      } catch (error) {
        console.error('导入失败', file.name, error);
        showToast(`《${file.name}》导入失败`);
      }
    }
    if (success > 0) {
      onImported();
      showToast(success === 1 ? '导入成功，开始阅读吧' : `已导入 ${success} 本书`);
    }
  };

  const handleDelete = async (book: Book) => {
    const confirmed = window.confirm(
      `删除《${book.title}》？书籍文件与阅读进度将一并移除。`
    );
    if (!confirmed) return;
    try {
      await removeBook(book.id);
      onRemoved();
      showToast('已删除');
    } catch (error) {
      console.error('删除失败', error);
      showToast('删除失败，请重试');
    }
  };

  const handleFeature = (feature: Feature) => {
    if (feature.action === 'profile') {
      onNavigateTab('profile');
      return;
    }
    if (feature.action === 'recent') {
      if (recentBook) onOpenBook(recentBook.id);
      else showToast('还没有在读的书，先导入一本吧');
      return;
    }
    if (feature.label === '书架') {
      document.getElementById('bookshelf')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    showToast(`「${feature.label}」规划中（${feature.milestone} 上线），敬请期待`);
  };

  return (
    <>
      <h1 className="page-title">书架</h1>

      <div
        className={`import-zone${dragging ? ' dragging' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
      >
        点击此处或拖入 .txt 文件
        <br />
        书籍仅保存在本机浏览器，不会上传
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        multiple
        hidden
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {recentBook && (
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
      )}

      <h2 className="section-title">功能</h2>
      <div className="feature-grid">
        {FEATURES.map((feature) => (
          <button
            key={feature.label}
            type="button"
            className={`feature-cell${feature.milestone ? ' planned' : ''}`}
            onClick={() => handleFeature(feature)}
          >
            <span className="feature-icon">{feature.icon}</span>
            <span>{feature.label}</span>
            {feature.milestone && <span className="feature-badge">{feature.milestone}</span>}
          </button>
        ))}
      </div>

      <h2 className="section-title" id="bookshelf">
        全部书籍（{books.length}）
      </h2>
      {books.length === 0 ? (
        <div className="empty-state">
          书架空空如也
          <br />
          导入一本 TXT，开始你的第一段阅读时光
        </div>
      ) : (
        books.map((book) => (
          <div className="card" key={book.id}>
            <div className="book-row">
              <div className="book-row-head">
                <span className="book-title">{book.title}</span>
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
                {formatSize(book.size)} · 进度 {Math.round(book.progress * 100)}% ·{' '}
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
                    const next =
                      STATUS_ORDER[(STATUS_ORDER.indexOf(book.status) + 1) % STATUS_ORDER.length];
                    onStatusChange(book, next);
                    showToast(`已标记为「${STATUS_LABEL[next]}」`);
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

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
