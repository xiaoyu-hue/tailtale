import type { Book, BookContent, BookFormat, BookStatus } from './model';
import { STORE_BOOKS, STORE_CONTENTS, run } from '../../platform/db';
import { hashBytes, hashText } from '../../platform/hash';

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
  const title = name.replace(/\.(txt|epub|pdf)$/i, '').trim();
  return title || '未命名书籍';
}

/** 按文件名后缀识别格式；无法识别返回 null（调用方计入 skipped）。 */
export function formatFromFilename(name: string): BookFormat | null {
  if (/\.txt$/i.test(name)) return 'txt';
  if (/\.epub$/i.test(name)) return 'epub';
  if (/\.pdf$/i.test(name)) return 'pdf';
  return null;
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
    await putContent({ id, kind: 'text', text });
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
  await putContent({ id, kind: 'text', text });
  await putBook(book);
  return book;
}

/** 导入 EPUB / PDF：读取文件二进制入库；重复导入同一文件时保留原阅读进度。 */
export async function importBinaryFile(file: File, format: 'epub' | 'pdf'): Promise<Book> {
  const data = await file.arrayBuffer();
  const id = hashBytes(data);
  const existing = await getBook(id);

  if (existing) {
    const updated: Book = {
      ...existing,
      title: titleFromFilename(file.name),
      size: data.byteLength,
    };
    await putContent({ id, kind: 'binary', data });
    await putBook(updated);
    return updated;
  }

  const book: Book = {
    id,
    title: titleFromFilename(file.name),
    format,
    size: data.byteLength,
    status: 'want',
    addedAt: Date.now(),
    lastReadAt: 0,
    progress: 0,
    chapterIndex: 0,
    scrollRatio: 0,
  };
  await putContent({ id, kind: 'binary', data });
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

/** 读取 TXT 全文（reader 模块经 books 公开 API 调用）。 */
export async function readBookContent(id: string): Promise<string> {
  const content: BookContent | undefined = await getContent(id);
  if (!content) {
    throw new Error('书籍内容缺失，可能已被浏览器清理，请重新导入');
  }
  // 兼容 M1 旧数据（无 kind 字段，直接存 text）
  if ('text' in content) return content.text;
  return '';
}

/** 读取 EPUB / PDF 二进制（reader 模块经 books 公开 API 调用）。 */
export async function readBookBinary(id: string): Promise<ArrayBuffer> {
  const content: BookContent | undefined = await getContent(id);
  if (!content) {
    throw new Error('书籍内容缺失，可能已被浏览器清理，请重新导入');
  }
  if ('data' in content) return content.data;
  // 旧数据或异常：文本内容按 UTF-8 编码兜底转二进制
  const text = 'text' in content ? content.text : '';
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

/** 保存阅读位置；从"想读"打开时自动转为"在读"。cfi 为 EPUB 精确位置（可选）。 */
export async function saveProgress(
  book: Book,
  chapterIndex: number,
  scrollRatio: number,
  progress: number,
  cfi?: string
): Promise<Book> {
  const updated: Book = {
    ...book,
    chapterIndex,
    scrollRatio,
    progress,
    lastReadAt: Date.now(),
    status: book.status === 'want' ? 'reading' : book.status,
    ...(cfi !== undefined ? { cfi } : {}),
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
