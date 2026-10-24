// 书摘存储（M4 书摘导出）：localStorage 持久化，轻量、本地优先、零后端。
export interface Highlight {
  id: string;
  bookId: string;
  bookTitle: string;
  cfi: string;
  text: string;
  createdAt: number;
}

const KEY = 'tailtale:highlights';
const listeners = new Set<() => void>();

function read(): Highlight[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: Highlight[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 存储不可用时静默 */
  }
  for (const l of listeners) l();
}

/** 全部书摘，按收藏时间倒序。 */
export function loadHighlights(): Highlight[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

/** 新增一条（阅读器中选中文字时调用）。 */
export function addHighlight(h: Omit<Highlight, 'id' | 'createdAt'>): Highlight {
  const item: Highlight = {
    ...h,
    id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  write([item, ...read()]);
  return item;
}

export function removeHighlight(id: string): void {
  write(read().filter((x) => x.id !== id));
}

export function clearHighlights(): void {
  write([]);
}

/** 订阅书摘变化（工具箱页面实时刷新）。 */
export function onHighlightsChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** 导出为 Markdown：按书名分组，附原文与收藏时间。 */
export function highlightsToMarkdown(list: Highlight[]): string {
  if (!list.length) return '';
  const byBook = new Map<string, Highlight[]>();
  for (const h of list) {
    const arr = byBook.get(h.bookTitle) ?? [];
    arr.push(h);
    byBook.set(h.bookTitle, arr);
  }
  const lines: string[] = ['# 书摘导出', ''];
  const date = new Date().toISOString().slice(0, 10);
  lines.push(`> 导出日期：${date} · 共 ${list.length} 条`, '');
  for (const [book, items] of byBook) {
    lines.push(`## ${book}`, '');
    for (const it of items) {
      lines.push(`> ${it.text}`, ``, `— 收藏于 ${new Date(it.createdAt).toLocaleString()}`, '');
    }
  }
  return lines.join('\n');
}

/** 触发浏览器下载一段文本。 */
export function downloadText(filename: string, content: string, mime = 'text/markdown'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
