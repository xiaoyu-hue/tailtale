import type { Book, BookContent, BookStatus } from './model';
import { STORE_BOOKS, STORE_CONTENTS, run } from '../../platform/db';
import { hashText } from '../../platform/hash';

// ---- IndexedDB 读写（books 模块自有 store 的类型化封装） ----

async function putBook(book: Book): Promise<void> {
  await run(STORE_BOOKS, 'readwrite', (s) => s.put(book));
}

async function getBook(id: string): Promise<Book | undefined> {
  return run<Book | undefined>(STORE_BOOKS, 'readonly', (s) => s.get(id));
}

async function getAllBooks(): Promise<Book[]> {
  return run<Book[]>(STORE_BOOKS, 'readonly', (s) => s.getAll());
}

async function deleteBook(id: string): Promise<void> {
  await run(STORE_BOOKS, 'readwrite', (s) => s.delete(id));
}

async function putContent(content: BookContent): Promise<void> {
  await run(STORE_CONTENTS, 'readwrite', (s) => s.put(content));
}

async function getContent(id: string): Promise<BookContent | undefined> {
  return run<BookContent | undefined>(STORE_CONTENTS, 'readonly', (s) => s.get(id));
}

async function deleteContent(id: string): Promise<void> {
  await run(STORE_CONTENTS, 'readwrite', (s) => s.delete(id));
}

// ---- 文本预处理 ----

function normalizeText(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function titleFromFilename(name: string): string {
  const title = name.replace(/\.txt$/i, '').trim();
  return title || '未命名书籍';
}

// ---- 模块对外能力（经 index.ts 暴露） ----

/** 导入本地 TXT：写入内容与元信息；重复导入同一文件时保留原阅读进度。 */
export async function importTxtFile(file: File): Promise<Book> {
  const raw = await file.text();
  const text = normalizeText(raw);
  const id = hashText(text);
  const existing = await getBook(id);

  if (existing) {
    const updated: Book = {
      ...existing,
      title: titleFromFilename(file.name),
      size: text.length,
    };
    await putContent({ id, text });
    await putBook(updated);
    return updated;
  }

  const book: Book = {
    id,
    title: titleFromFilename(file.name),
    format: 'txt',
    size: text.length,
    status: 'want',
    addedAt: Date.now(),
    lastReadAt: 0,
    progress: 0,
    chapterIndex: 0,
    scrollRatio: 0,
  };
  await putContent({ id, text });
  await putBook(book);
  return book;
}

export async function loadBooks(): Promise<Book[]> {
  const books = await getAllBooks();
  return books.sort(
    (a, b) => (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt)
  );
}

export async function removeBook(id: string): Promise<void> {
  await deleteBook(id);
  await deleteContent(id);
}

/** 读取书籍全文（reader 模块经 books 公开 API 调用）。 */
export async function readBookContent(id: string): Promise<string> {
  const content: BookContent | undefined = await getContent(id);
  if (!content) {
    throw new Error('书籍内容缺失，可能已被浏览器清理，请重新导入');
  }
  return content.text;
}

/** 保存阅读位置；从"想读"打开时自动转为"在读"。 */
export async function saveProgress(
  book: Book,
  chapterIndex: number,
  scrollRatio: number,
  progress: number
): Promise<Book> {
  const updated: Book = {
    ...book,
    chapterIndex,
    scrollRatio,
    progress,
    lastReadAt: Date.now(),
    status: book.status === 'want' ? 'reading' : book.status,
  };
  await putBook(updated);
  return updated;
}

/** 显式设置阅读状态（书架页的状态循环按钮）。 */
export async function setBookStatus(book: Book, status: BookStatus): Promise<Book> {
  const updated: Book = { ...book, status };
  await putBook(updated);
  return updated;
}
