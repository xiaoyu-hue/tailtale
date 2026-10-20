import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar';
import BottomNav, { type TabKey } from '../components/BottomNav';
import Home from '../pages/Home';
import Reader from '../pages/Reader';
import Pet from '../pages/Pet';
import Shop from '../pages/Shop';
import Profile from '../pages/Profile';
import { loadBooks, saveProgress } from '../lib/books';
import type { Book } from '../types';

type Route =
  | { name: 'home' }
  | { name: 'reader'; bookId: string }
  | { name: 'pet' }
  | { name: 'shop' }
  | { name: 'profile' };

const TAB_OF_ROUTE: Record<Route['name'], TabKey> = {
  home: 'home',
  reader: 'home',
  pet: 'pet',
  shop: 'shop',
  profile: 'profile',
};

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [route, setRoute] = useState<Route>({ name: 'home' });

  useEffect(() => {
    loadBooks()
      .then(setBooks)
      .catch((error: unknown) => {
        console.error('加载书架失败', error);
      });
  }, []);

  const reloadBooks = () => {
    loadBooks()
      .then(setBooks)
      .catch((error: unknown) => {
        console.error('加载书架失败', error);
      });
  };

  const patchBook = (updated: Book) => {
    setBooks((prev) => prev.map((book) => (book.id === updated.id ? updated : book)));
  };

  const currentBook =
    route.name === 'reader' ? books.find((book) => book.id === route.bookId) : undefined;

  const handleProgress = (
    book: Book,
    chapterIndex: number,
    scrollRatio: number,
    progress: number
  ) => {
    void saveProgress(book, chapterIndex, scrollRatio, progress).then(patchBook);
  };

  const handleFinish = (book: Book) => {
    patchBook({ ...book, status: 'finished' });
    void saveProgress(book, book.chapterIndex, book.scrollRatio, 1);
  };

  const handleStatusChange = (book: Book, status: Book['status']) => {
    const updated = { ...book, status };
    patchBook(updated);
    void saveProgress(updated, updated.chapterIndex, updated.scrollRatio, updated.progress);
  };

  const goTab = (tab: TabKey) => {
    if (tab === 'home') setRoute({ name: 'home' });
    else if (tab === 'pet') setRoute({ name: 'pet' });
    else if (tab === 'shop') setRoute({ name: 'shop' });
    else setRoute({ name: 'profile' });
  };

  // 阅读页为全屏沉浸形态：不显示顶栏与底部导航
  if (route.name === 'reader' && currentBook) {
    return (
      <Reader
        book={currentBook}
        onBack={() => setRoute({ name: 'home' })}
        onProgress={handleProgress}
        onFinish={handleFinish}
      />
    );
  }

  return (
    <div className="app-shell">
      <TopBar />
      <main className="page">
        {route.name === 'home' && (
          <Home
            books={books}
            onImported={reloadBooks}
            onRemoved={reloadBooks}
            onOpenBook={(bookId) => setRoute({ name: 'reader', bookId })}
            onStatusChange={handleStatusChange}
            onNavigateTab={goTab}
          />
        )}
        {route.name === 'pet' && <Pet />}
        {route.name === 'shop' && <Shop />}
        {route.name === 'profile' && <Profile />}
      </main>
      <BottomNav active={TAB_OF_ROUTE[route.name]} onChange={goTab} />
    </div>
  );
}
