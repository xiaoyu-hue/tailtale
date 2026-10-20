export type BookStatus = 'want' | 'reading' | 'finished';

export interface Book {
  /** 内容指纹：同一文件在任何设备上得到相同 id，用于进度续读 */
  id: string;
  title: string;
  format: 'txt';
  /** 字符数（UTF-16 码元长度） */
  size: number;
  status: BookStatus;
  addedAt: number;
  lastReadAt: number;
  /** 总进度 0~1 */
  progress: number;
  /** 上次阅读所在章节下标 */
  chapterIndex: number;
  /** 章内滚动比例 0~1 */
  scrollRatio: number;
}

export interface BookContent {
  id: string;
  text: string;
}
