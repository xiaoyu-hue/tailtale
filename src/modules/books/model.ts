export type BookStatus = 'want' | 'reading' | 'finished';

/** 支持的书籍格式：TXT 全文阅读；EPUB / PDF 存二进制，由对应引擎渲染 */
export type BookFormat = 'txt' | 'epub' | 'pdf';

export const FORMAT_LABEL: Record<BookFormat, string> = {
  txt: 'TXT',
  epub: 'EPUB',
  pdf: 'PDF',
};

export interface Book {
  /** 内容指纹：同一文件在任何设备上得到相同 id，用于进度续读 */
  id: string;
  title: string;
  format: BookFormat;
  /** 字符数（TXT）或字节数（EPUB / PDF） */
  size: number;
  status: BookStatus;
  addedAt: number;
  lastReadAt: number;
  /** 总进度 0~1 */
  progress: number;
  /** 上次阅读所在章节下标（TXT）或页码（PDF，从 0 起） */
  chapterIndex: number;
  /** 章内滚动比例 0~1（TXT）；EPUB 为 0，进度以 cfiPercentage 另行保存 */
  scrollRatio: number;
  /** EPUB 专用：上次阅读位置的 CFI（epub.js rendition location.start.cfi），用于精确续读 */
  cfi?: string;
}

/**
 * 书籍内容：TXT 存全文文本，EPUB / PDF 存文件二进制。
 * 联合类型分流，reader 模块按类型收窄后调用对应引擎。
 */
export type BookContent =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'binary'; data: ArrayBuffer };

export const STATUS_LABEL: Record<BookStatus, string> = {
  want: '想读',
  reading: '在读',
  finished: '读完',
};

const STATUS_ORDER: BookStatus[] = ['want', 'reading', 'finished'];

/** 状态循环：想读 → 在读 → 读完 → 想读 */
export function nextStatus(status: BookStatus): BookStatus {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length];
}
