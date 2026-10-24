import { useEffect, useState } from 'react';
import MiniSearch from 'minisearch';
import { useBooks, extractText } from '../../books';
import { toast } from '../../../components';
import type { ToolProps } from './ToolboxView';

interface Doc {
  id: string;
  title: string;
  author: string;
  text?: string;
}

/** 全文搜索：minisearch 本地索引，默认搜书名/作者，可一键索引正文搜内容。零云端。 */
export function SearchTool({ onOpenBook, onClose }: ToolProps) {
  const books = useBooks();
  const [query, setQuery] = useState('');
  const [ms, setMs] = useState<MiniSearch<Doc> | null>(null);
  const [results, setResults] = useState<Doc[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [textIndexed, setTextIndexed] = useState(false);

  // 元数据索引（书名/作者），随书架变化重建
  useEffect(() => {
    const m = new MiniSearch<Doc>({
      fields: ['title', 'author', 'text'],
      storeFields: ['title', 'author', 'text'],
      searchOptions: { boost: { title: 3, author: 2 }, fuzzy: 0.2, prefix: true },
    });
    m.addAll(books.map((b) => ({ id: b.id, title: b.title, author: '' })));
    setMs(m);
    setTextIndexed(false);
  }, [books]);

  function runSearch(m: MiniSearch<Doc>, q: string): Doc[] {
    if (!q.trim()) return [];
    return m.search(q.trim()).map((r) => {
      const d = r as unknown as Doc;
      return { id: String(d.id), title: String(d.title), author: String(d.author), text: d.text };
    });
  }

  function search(q: string): Doc[] {
    if (!ms) return [];
    return runSearch(ms, q);
  }

  function onInput(q: string) {
    setQuery(q);
    setResults(search(q));
  }

  async function indexText() {
    if (!ms) return;
    setIndexing(true);
    try {
      const docs: Doc[] = [];
      for (const b of books) {
        try {
          const text = await extractText(b);
          docs.push({ id: b.id, title: b.title, author: b.author ?? '', text: text.slice(0, 100000) });
        } catch {
          docs.push({ id: b.id, title: b.title, author: b.author ?? '' });
        }
      }
      const m = new MiniSearch<Doc>({
        fields: ['title', 'author', 'text'],
        storeFields: ['title', 'author', 'text'],
        searchOptions: { boost: { title: 3, author: 2 }, fuzzy: 0.2, prefix: true },
      });
      m.addAll(docs);
      setMs(m);
      setTextIndexed(true);
      toast.success('正文索引完成，可搜索书中内容');
      setResults(runSearch(m, query));
    } finally {
      setIndexing(false);
    }
  }

  function openBook(id: string) {
    onOpenBook?.(id);
    onClose?.();
  }

  return (
    <div className="search">
      <input
        className="search-input"
        placeholder="搜索书名、作者…"
        value={query}
        onChange={(e) => onInput(e.target.value)}
      />
      <div className="search-meta">
        <span className="muted">{results.length} 条结果</span>
        <button type="button" className="btn btn-primary" onClick={indexText} disabled={indexing}>
          {indexing ? '索引中…' : textIndexed ? '重建正文索引' : '索引正文'}
        </button>
      </div>
      <div className="search-results">
        {results.map((r) => (
          <button key={r.id} type="button" className="search-item" onClick={() => openBook(r.id)}>
            <div className="search-title">{r.title}</div>
            <div className="muted search-author">{r.author || '佚名'}</div>
            {r.text && <div className="search-snippet">…{r.text.slice(0, 60)}…</div>}
          </button>
        ))}
        {!results.length && (
          <div className="muted" style={{ textAlign: 'center', padding: 12 }}>
            {query.trim() ? '没有匹配' : '输入关键词开始搜索；点「索引正文」可搜书中内容'}
          </div>
        )}
      </div>
    </div>
  );
}
