// vendored foliate-js mobi.js 的类型声明。
// 上游为纯 JS、无 .d.ts，此处仅声明书时实际使用的 API 面；
// 随 src/vendor/foliate/mobi.js 更新而同步维护（改 API 必须同步改这里）。

/** KF8 的 sections 中，frags 为空的项是占位对象（无解析方法），遍历时必须过滤。 */
export interface MobiSection {
  id: number;
  /** 载入整节为 blob: URL（书时未使用：自渲染走 createDocument） */
  load: () => Promise<string>;
  /** 解析整节为 Document（净化后取其 body 内容自渲染） */
  createDocument: () => Promise<Document>;
  size: number;
}

export type MobiSectionEntry = MobiSection | { linear: 'no' };

export interface MobiTocItem {
  label: string;
  href: string;
  subitems?: MobiTocItem[];
}

export interface MobiBook {
  sections: MobiSectionEntry[];
  metadata: {
    identifier?: string;
    title?: string;
    author?: string[];
    publisher?: string;
    language?: string;
    published?: string;
    description?: string;
    subject?: string[];
    rights?: string;
    contributor?: string[];
  };
  /** KF8 为 { label, href, subitems } 树；MOBI6 为带 filepos 属性的 <a> 元素列表 */
  toc?: MobiTocItem[] | HTMLAnchorElement[];
  landmarks?: Array<{ label?: string; type?: string[]; href: string }>;
  getCover?: () => Promise<Blob>;
  /** 释放内部缓存的 blob: URL（书时只用 createDocument，缓存通常为空，仍调用兜底） */
  destroy: () => void;
  /** KF8：kindle:pos:fid:XXXX → 章节下标 */
  getIndexByFID?: (fid: number) => number;
  /** MOBI6：filepos:NNN → 章节下标 */
  resolveHref?: (href: string) => { index: number };
}

export class MOBI {
  constructor(options: { unzlib: (data: Uint8Array) => Uint8Array | Promise<Uint8Array> });
  open(file: Blob): Promise<MobiBook>;
}
