export type BookStatus = 'want' | 'reading' | 'finished';

/** 支持的书籍格式：TXT 全文阅读；EPUB / PDF / CBZ 存二进制，由对应引擎渲染。
 * 注意：FB2 在导入期转换为 EPUB 落库（见 importFb2File），因此不在此枚举；
 * MOBI / AZW3 在批次2 经 foliate-js 接入时再补入。 */
export type BookFormat = 'txt' | 'epub' | 'pdf' | 'cbz';

export const FORMAT_LABEL: Record<BookFormat, string> = {
  txt: 'TXT',
  epub: 'EPUB',
  pdf: 'PDF',
  cbz: 'CBZ',
};

export interface Book {
  /** 内容指纹：同一文件在任何设备上得到相同 id，用于进度续读 */
  id: string;
  title: string;
  /** 作者（FB2 / MOBI / CBZ 等格式自带元数据；旧 TXT/EPUB/PDF 数据可能无此字段，按 undefined 兼容） */
  author?: string;
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
  /** 来源：import = 用户本地导入；builtin = 内置公版书库领取。旧数据无此字段按 import 处理 */
  source?: 'import' | 'builtin';
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
