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
  const title = name.replace(/\.(txt|epub|pdf|cbz)$/i, '').trim();
  return title || '未命名书籍';
}

/** 二进制存储格式（不含 txt）。批次2 接入 MOBI/AZW3 时在此扩展。 */
type BinaryFormat = 'epub' | 'pdf' | 'cbz';

/** 按文件名后缀识别格式；无法识别返回 null（调用方计入 skipped）。 */
export function formatFromFilename(name: string): BookFormat | null {
  if (/\.txt$/i.test(name)) return 'txt';
  if (/\.epub$/i.test(name)) return 'epub';
  if (/\.pdf$/i.test(name)) return 'pdf';
  if (/\.cbz$/i.test(name)) return 'cbz';
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

/** 内部：把一份二进制内容落库为指定格式的书（含去重与进度保留）；供各二进制导入入口复用。 */
async function storeBinaryBook(
  data: ArrayBuffer,
  format: BinaryFormat,
  title: string,
  size: number,
  author?: string,
  onProgress?: (ratio: number) => void
): Promise<Book> {
  const id = await hashBytes(data, onProgress);
  const existing = await getBook(id);

  if (existing) {
    const updated: Book = {
      ...existing,
      title,
      size,
      ...(author !== undefined ? { author } : {}),
    };
    await putContent({ id, kind: 'binary', data });
    await putBook(updated);
    return updated;
  }

  const book: Book = {
    id,
    title,
    format,
    size,
    ...(author !== undefined ? { author } : {}),
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

/** 导入 EPUB / PDF / CBZ：读取文件二进制入库；重复导入同一文件时保留原阅读进度。
 * onProgress 透传至内容指纹计算，用于大文件导入时的进度反馈。 */
export async function importBinaryFile(
  file: File,
  format: BinaryFormat,
  onProgress?: (ratio: number) => void
): Promise<Book> {
  const data = await file.arrayBuffer();
  return storeBinaryBook(data, format, titleFromFilename(file.name), data.byteLength, undefined, onProgress);
}

/** 导入 FB2：解析后转换为 EPUB 落库（format 实为 'epub'，复用 EpubReader 全部能力）。
 * 转换确定性保证同文件内容指纹一致、重复导入去重、跨设备续读一致。 */
export async function importFb2File(file: File): Promise<Book> {
  const xml = await file.text();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('FB2 解析失败：文件不是合法的 XML');
  }
  const { fb2ToEpub } = await import('./fb2');
  const { epub, title, author } = await fb2ToEpub(doc);
  return storeBinaryBook(epub, 'epub', title, epub.byteLength, author);
}

/** 内置公版书领取（M7）：与导入完全同一数据链路——内容指纹即 id，已领取过直接返回既有书。
 * source 标为 builtin：数据备份不导出其内容（可随时从书库重新领取），书架行为与导入书一致。 */
export async function addBuiltinBook(input: { title: string; text: string }): Promise<Book> {
  const id = hashText(input.text);
  const existing = await getBook(id);
  if (existing) return existing;

  const book: Book = {
    id,
    title: input.title,
    format: 'txt',
    size: input.text.length,
    status: 'want',
    addedAt: Date.now(),
    lastReadAt: 0,
    progress: 0,
    chapterIndex: 0,
    scrollRatio: 0,
    source: 'builtin',
  };
  await putContent({ id, kind: 'text', text: input.text });
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
