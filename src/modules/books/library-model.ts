/** 内置公版书库（M7）：纯函数与类型层（可单测，零 import）。
 * 副作用（网络下载、落库）在 library.ts，本文件不触碰 DOM 与存储。 */

/** 书单条目（manifest.json 随包分发；书籍本体随应用同源分发，领取时按需读取）。 */
export interface LibraryBook {
  /** 书籍文件名（相对 LIBRARY_BASE_URL） */
  file: string;
  title: string;
  author: string;
  dynasty: string;
  /** 字符数 */
  chars: number;
  /** 章节数（阅读器可识别的标题行数；0 = 单章） */
  chapters: number;
  /** 清洗后文本的 hashText 指纹：既用于下载校验，也作为「是否已领取」的判据 */
  fingerprint: string;
}

/** 书单文件结构。 */
export interface LibraryManifest {
  books: LibraryBook[];
}

/** 校验 manifest 数据形状；不合法时抛出带中文原因的 Error。 */
export function parseLibraryManifest(data: unknown): LibraryBook[] {
  if (typeof data !== 'object' || data === null) {
    throw new Error('书单内容格式不正确');
  }
  const books = (data as { books?: unknown }).books;
  if (!Array.isArray(books)) {
    throw new Error('书单数据损坏：books 字段缺失');
  }
  for (const entry of books) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error('书单数据损坏：存在无效条目');
    }
    const b = entry as Partial<LibraryBook>;
    if (
      typeof b.file !== 'string' || b.file === '' ||
      typeof b.title !== 'string' || b.title === '' ||
      typeof b.author !== 'string' ||
      typeof b.dynasty !== 'string' ||
      typeof b.chars !== 'number' || !Number.isFinite(b.chars) ||
      typeof b.chapters !== 'number' || !Number.isFinite(b.chapters) ||
      typeof b.fingerprint !== 'string' || b.fingerprint === ''
    ) {
      throw new Error('书单数据损坏：条目字段缺失');
    }
  }
  return books as LibraryBook[];
}
