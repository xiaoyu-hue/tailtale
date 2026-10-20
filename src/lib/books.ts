import type { Book, BookContent } from '../types';
import {
  deleteBook,
  deleteContent,
  getAllBooks,
  getBook,
  getContent,
  putBook,
  putContent,
} from '../platform/db';
import { hashText } from '../platform/hash';

function normalizeText(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function titleFromFilename(name: string): string {
  const title = name.replace(/\.txt$/i, '').trim();
  return title || '未命名书籍';
}

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
