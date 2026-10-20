import { emit } from '../../platform/events';
import { createStore, useStore } from '../../platform/store';
import type { Book, BookStatus } from './model';
import { formatFromFilename, importBinaryFile, importTxtFile, loadBooks, removeBook, saveProgress, setBookStatus } from './service';

interface BooksState {
  books: Book[];
  loaded: boolean;
}

const store = createStore<BooksState>({ books: [], loaded: false });

// ---- 订阅 hooks ----

export function useBooks(): Book[] {
  return useStore(store, (s) => s.books);
}

/** 最近阅读的书（lastReadAt > 0）；selector 返回 state 中已存在的引用，引用稳定。 */
export function useRecentBook(): Book | undefined {
  return useStore(store, (s) => s.books.find((b) => b.lastReadAt > 0));
}

// ---- 状态动作 ----

function patchBook(updated: Book): void {
  store.setState((s) => ({
    ...s,
    books: s.books.map((b) => (b.id === updated.id ? updated : b)),
  }));
}

export async function refreshBooks(): Promise<void> {
  const books = await loadBooks();
  store.setState({ books, loaded: true });
}

export interface ImportResult {
  /** 成功导入数量 */
  ok: number;
  /** 导入失败的文件名 */
  failed: string[];
  /** 因格式不支持（非 TXT）被跳过的数量 */
  skipped: number;
}

/** 批量导入：按扩展名分发到 TXT / EPUB / PDF 对应处理器。 */
export async function importFiles(files: FileList | null): Promise<ImportResult> {
  if (!files || files.length === 0) return { ok: 0, failed: [], skipped: 0 };
  const all = Array.from(files);

  const failed: string[] = [];
  let ok = 0;
  let skipped = 0;
  for (const file of all) {
    const format = formatFromFilename(file.name);
    if (!format) {
      skipped += 1;
      continue;
    }
    try {
      if (format === 'txt') {
        await importTxtFile(file);
      } else {
        await importBinaryFile(file, format);
      }
      ok += 1;
    } catch (error) {
      console.error('导入失败', file.name, error);
      failed.push(file.name);
    }
  }
  if (ok > 0) await refreshBooks();
  return { ok, failed, skipped };
}

export async function deleteBookById(book: Book): Promise<void> {
  await removeBook(book.id);
  store.setState((s) => ({ ...s, books: s.books.filter((b) => b.id !== book.id) }));
}

/**
 * 切换阅读状态（书架页状态循环按钮）。
 * 立即更新 UI、后台持久化——与 M1 行为一致的乐观更新，
 * 避免点击后界面因等待 IndexedDB 写入而延迟。
 */
export function changeStatus(book: Book, status: BookStatus): void {
  patchBook({ ...book, status });
  void setBookStatus(book, status).catch((error: unknown) => {
    console.error('状态保存失败', error);
  });
}

/** 阅读器汇报进度（防抖后调用，fire-and-forget）。cfi 为 EPUB 精确位置（可选）。 */
export async function reportProgress(
  book: Book,
  chapterIndex: number,
  scrollRatio: number,
  progress: number,
  cfi?: string
): Promise<void> {
  patchBook(await saveProgress(book, chapterIndex, scrollRatio, progress, cfi));
}

/** 读完：立即置 finished 与 100% 进度，后台持久化（与 M1 行为一致的乐观更新）。
 * 内部取 store 中最新状态，避免与并发的 reportProgress 补丁相互覆盖（竞态）。 */
export function markFinished(book: Book): void {
  const latest = store.getState().books.find((b) => b.id === book.id) ?? book;
  patchBook({ ...latest, status: 'finished', progress: 1 });
  void saveProgress({ ...latest, status: 'finished' }, latest.chapterIndex, latest.scrollRatio, 1).catch(
    (error: unknown) => {
      console.error('读完状态保存失败', error);
    }
  );
  // 广播完读事件：gamification 模块监听后发放一次性奖励（模块间只经事件总线交互）
  emit('book:finished', { bookId: book.id });
}
