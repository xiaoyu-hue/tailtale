import { emit } from '../../platform/events';
import { createStore, useStore } from '../../platform/store';
import type { Book, BookStatus } from './model';
import { formatFromFilename, importBinaryFile, importTxtFile, loadBooks, removeBook, saveProgress, setBookStatus } from './service';
import { claimBuiltinBook } from './library';
import type { LibraryBook } from './library-model';

interface BooksState {
  books: Book[];
  loaded: boolean;
}

const store = createStore<BooksState>({ books: [], loaded: false });

// ---- 订阅 hooks ----

export function useBooks(): Book[] {
  return useStore(store, (s) => s.books);
}

/** 书架是否已从 IndexedDB 加载完成（用于区分「还没加载」与「确实没有这本书」）。 */
export function useBooksLoaded(): boolean {
  return useStore(store, (s) => s.loaded);
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

/** 批量导入：按扩展名分发到 TXT / EPUB / PDF 对应处理器。
 * onProgress 透传至二进制指纹计算，用于大文件导入时的进度反馈。 */
export async function importFiles(
  files: FileList | null,
  onProgress?: (ratio: number) => void
): Promise<ImportResult> {
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
        await importBinaryFile(file, format, onProgress);
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
 * 领取一本内置公版书：读取 → 指纹校验 → 落库（library.ts）→ 增量同步 store。
 * 落库不同步 store 的话，useBooks 拿不到新书，「已领取」判据与书架列表都不更新——
 * 本 action 是领取链路在 UI 层生效的必要一环。重复领取时 service 直接返回既有书，
 * 此时 store 去重后不重复追加。
 */
export async function claimBuiltin(entry: LibraryBook): Promise<void> {
  const book = await claimBuiltinBook(entry);
  store.setState((s) =>
    s.books.some((b) => b.id === book.id) ? s : { ...s, books: [...s.books, book] }
  );
}

/**
 * 切换阅读状态（书架页状态循环按钮）。
 * 立即更新 UI、后台持久化——与 M1 行为一致的乐观更新，
 * 避免点击后界面因等待 IndexedDB 写入而延迟。
 */
export function changeStatus(book: Book, status: BookStatus): void {
  const prev = store.getState().books.find((b) => b.id === book.id) ?? book;
  patchBook({ ...book, status });
  void setBookStatus({ ...book, status }, status).catch((error: unknown) => {
    console.error('状态保存失败', error);
    patchBook(prev); // 持久化失败时回滚 UI，避免界面与实际存储不一致
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

/** 读完：立即置 finished 与 100% 进度（乐观更新），后台持久化；
 * 内部取 store 中最新状态，避免与并发的 reportProgress 补丁相互覆盖（竞态）。
 * 只有持久化成功才广播 book:finished（触发发放一次性金币），保存失败时回滚 UI，
 * 避免出现「发币但没记账」的资产与状态不一致。 */
export async function markFinished(book: Book): Promise<void> {
  const latest = store.getState().books.find((b) => b.id === book.id) ?? book;
  const finished: Book = { ...latest, status: 'finished', progress: 1 };
  patchBook(finished);
  try {
    await saveProgress(finished, latest.chapterIndex, latest.scrollRatio, 1);
  } catch (error) {
    console.error('读完状态保存失败', error);
    patchBook(latest);
    return;
  }
  // 广播完读事件：gamification 模块监听后发放一次性奖励（模块间只经事件总线交互）
  emit('book:finished', { bookId: book.id });
}
