import { useEffect, useState } from 'react';
import { useBooks, claimBuiltin } from '../store';
import { fetchLibraryManifest } from '../library';
import type { LibraryBook } from '../library-model';

interface LibrarySectionProps {
  onOpenBook: (bookId: string) => void;
  onToast: (message: string) => void;
}

/** 外部权威公版书库：只给站点首页，新标签页打开（外链内容与版权状态由各站点自行负责）。 */
const EXTERNAL_SOURCES: { name: string; url: string; note: string }[] = [
  { name: '中国哲学书电子化计划', url: 'https://ctext.org', note: '先秦至清末古籍' },
  { name: '维基文库', url: 'https://zh.wikisource.org', note: '中文古诗文与公版文本' },
  { name: '识典古籍', url: 'https://shidianguji.com', note: '古籍整理平台' },
  { name: '古腾堡计划', url: 'https://www.gutenberg.org', note: '外文原著公版库' },
];

/** TXT 字数展示：与书架 formatSize 的万字口径一致。 */
function formatChars(chars: number): string {
  if (chars >= 10000) return `${(chars / 10000).toFixed(1)} 万字`;
  return `${chars} 字`;
}

/** 精选书库板块（M7）：内置公版书按需领取 + 外部公版源链接。
 * 已领取判据：书架中存在 id === manifest.fingerprint 的书（领取后 id 即指纹）。 */
export function LibrarySection({ onOpenBook, onToast }: LibrarySectionProps) {
  const books = useBooks();
  const [entries, setEntries] = useState<LibraryBook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchLibraryManifest()
      .then((list) => { if (!cancelled) { setEntries(list); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : '书单加载失败'); });
    return () => { cancelled = true; };
  }, []);

  const handleClaim = async (entry: LibraryBook) => {
    setClaiming(entry.file);
    try {
      await claimBuiltin(entry);
      onToast(`《${entry.title}》已收入书架`);
    } catch (e) {
      console.error('领书失败', entry.file, e);
      onToast(e instanceof Error ? e.message : '领取失败，请重试');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <section className="library-section" id="library">
      <h2 className="section-title">精选书库</h2>
      <p className="muted library-intro">
        内置公版经典，领取后与导入的书一样阅读、计时、赚金币
      </p>

      {error && <div className="empty-state">{error}</div>}

      {entries === null && !error && <div className="empty-state">书单加载中…</div>}

      {entries !== null && entries.map((entry) => {
        const owned = books.find((b) => b.id === entry.fingerprint);
        return (
          <div className="card" key={entry.file}>
            <div className="book-row">
              <div className="book-row-head">
                <span className="book-title">{entry.title}</span>
                <span className="chip">{entry.dynasty}</span>
              </div>
              <div className="book-meta">
                {entry.author} · {formatChars(entry.chars)}
                {entry.chapters > 0 ? ` · ${entry.chapters} 章` : ''}
              </div>
              <div className="btn-row">
                {owned ? (
                  <button type="button" className="btn btn-primary" onClick={() => onOpenBook(owned.id)}>
                    {owned.progress > 0 ? '继续阅读' : '开始阅读'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={claiming !== null}
                    onClick={() => void handleClaim(entry)}
                  >
                    {claiming === entry.file ? '领取中…' : '领取'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <h3 className="section-title library-sources-title">还想找更多？</h3>
      <div className="card">
        <div className="book-row">
          <p className="muted library-sources-note">
            这些公版书库可去逛逛（在新标签页打开）；书时不提供盗版书源，外链站点的内容与其版权状态由各站点自行负责
          </p>
          <div className="btn-row library-source-row">
            {EXTERNAL_SOURCES.map((source) => (
              <a
                key={source.url}
                className="btn"
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.name}
                <span className="muted"> · {source.note}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
