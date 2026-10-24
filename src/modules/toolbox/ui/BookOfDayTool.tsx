import { useCallback, useEffect, useState } from 'react';
import { fetchLibraryManifest, claimBuiltinBook, useBooks } from '../../books';
import type { LibraryBook } from '../../books/library-model';
import { toast } from '../../../components';

/** 今日一书：从内置公版书库随机推荐一本，可换一本或加入书架。 */
export function BookOfDayTool() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [current, setCurrent] = useState<LibraryBook | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [busy, setBusy] = useState(false);
  const myBooks = useBooks();

  const load = useCallback(async () => {
    try {
      const list = await fetchLibraryManifest();
      setBooks(list);
      pick(list);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  const pick = (list: LibraryBook[]) => {
    if (!list.length) {
      setCurrent(null);
      return;
    }
    setCurrent(list[Math.floor(Math.random() * list.length)]);
    setClaimed(false);
  };

  useEffect(() => {
    void load();
  }, [load]);

  function shuffle() {
    pick(books);
  }

  async function claim() {
    if (!current || claimed) return;
    setBusy(true);
    try {
      await claimBuiltinBook(current);
      setClaimed(true);
      toast.success(`已加入书架：${current.title}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!current) {
    return <div className="muted" style={{ textAlign: 'center', padding: 24 }}>书库为空或加载中…</div>;
  }

  const alreadyInShelf = myBooks.some((b) => b.title === current.title);

  return (
    <div className="bookofday">
      <div className="bookofday-cover" aria-hidden="true">
        {current.title.slice(0, 1)}
      </div>
      <h3 className="bookofday-title">{current.title}</h3>
      <div className="muted bookofday-meta">
        {current.author} · {current.dynasty} · 约 {current.chars.toLocaleString()} 字
        {current.chapters > 1 ? ` · ${current.chapters} 章` : ''}
      </div>

      <div className="bookofday-actions">
        <button type="button" className="btn" onClick={shuffle}>
          换一本
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={claim}
          disabled={busy || claimed || alreadyInShelf}
        >
          {claimed || alreadyInShelf ? '已在书架' : '加入书架'}
        </button>
      </div>
    </div>
  );
}
