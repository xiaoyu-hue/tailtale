import type { MobiBook, MobiTocItem } from '../../vendor/foliate/mobi.js';
// 带 .js 扩展名：测试编译用 NodeNext 模块解析（要求显式扩展名），
// 主构建的 bundler 解析同样兼容——这是 TS 跨双模块解析的标准写法。
import { blockText } from './html-text.js';

// ---- MOBI / AZW3 解析适配（vendored foliate-js mobi.js，批次2 引入） ----
// 分层职责：本文件是 books 模块对 MOBI 格式的唯一集成点——
// reader 只消费 openMobiBook 产出的净化 HTML / 目录 / 元数据（经 books/index.ts 公开 API）；
// extract.ts 复用同一解析结果做 TTS / 全文搜索 / AI 的正文抽取。
// 绝不整套引入 foliate-js、不替换 epubjs：仅 vendored 单文件 mobi.js，按需动态加载。

/** fflate 的异步 unzlib 为回调式（无 Promise 重载），包一层供 mobi.js 的 `await unzlib(...)` 使用。
 * 直接注入 fflate.unzlib 会在解析内嵌字体记录时抛 "no callback"——这是接入时的关键坑。
 * fflate 在函数内动态加载：绝大多数 MOBI 无内嵌字体，用不到就不下载这 8KB。 */
export async function unzlibAsync(data: Uint8Array): Promise<Uint8Array> {
  const { unzlib } = await import('fflate');
  return new Promise((resolve, reject) => {
    unzlib(data, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

/** 自渲染前必须整体移除的元素：脚本 / 插件 / 框架 / 表单 / 外部资源引用。
 * MOBI 内联图片为 kindle:// 协议，自渲染无法解析，一并移除（不影响正文文字）。 */
const REMOVE_TAGS = [
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'link', 'img', 'image', 'svg', 'audio', 'video', 'source', 'form',
  'input', 'button', 'select', 'textarea', 'meta', 'base', 'noscript',
];

/** 净化 mobi.js 解析出的章节 Document：去危险元素、on* 事件属性与 javascript: 协议链接。
 * 对应 epubjs 的 allowScriptedContent:false——自渲染 HTML（innerHTML）前必须过这一关。 */
export function sanitizeMobiDoc(doc: Document): void {
  for (const tag of REMOVE_TAGS) {
    for (const el of Array.from(doc.querySelectorAll(tag))) el.remove();
  }
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (
        (name === 'href' || name === 'src' || name === 'action' || name === 'formaction') &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }
}

/** 目录项：label + 目标章节下标；level 用于缩进（KF8 目录树扁平化）。
 * index 为 -1 表示无法定位（调用方点击时忽略该项）。 */
export interface MobiTocEntry {
  label: string;
  index: number;
  level: number;
}

/**
 * 归一化 mobi.js 的目录为统一扁平列表。两类引擎形状不同：
 * - KF8：{ label, href, subitems } 对象树，href 为 kindle:pos:fid:XXXX:off:YYYY，
 *   经 book.getIndexByFID(fid) 映射到章节下标；
 * - MOBI6：带 filepos 属性的 <a> 元素列表，href 为 filepos:NNN，
 *   经 book.resolveHref(href).index 映射。
 */
export function mobiTocEntries(book: MobiBook): MobiTocEntry[] {
  const entries: MobiTocEntry[] = [];
  const resolve = (href: string): number => {
    const pos = /kindle:pos:fid:(\w+):off:(\w+)/.exec(href);
    if (pos && typeof book.getIndexByFID === 'function') {
      return book.getIndexByFID(parseInt(pos[1], 32));
    }
    if (typeof book.resolveHref === 'function') {
      try {
        return book.resolveHref(href).index;
      } catch {
        return -1;
      }
    }
    return -1;
  };
  const walk = (items: MobiTocItem[], level: number): void => {
    for (const item of items) {
      entries.push({ label: item.label || '未命名', index: resolve(item.href ?? ''), level });
      if (item.subitems?.length) walk(item.subitems, level + 1);
    }
  };
  const raw = book.toc;
  if (!raw || !Array.isArray(raw)) return entries;
  // MOBI6 的 toc 是 <a filepos="NNN"> 元素列表；KF8 是普通对象树。用 getAttribute 判别形状。
  if (raw.length > 0 && typeof (raw[0] as HTMLElement).getAttribute === 'function') {
    for (const anchor of raw as HTMLAnchorElement[]) {
      const filepos = anchor.getAttribute('filepos') ?? '';
      entries.push({
        label: (anchor.textContent ?? '').trim() || '未命名',
        index: resolve(`filepos:${filepos}`),
        level: 0,
      });
    }
  } else {
    walk(raw as MobiTocItem[], 0);
  }
  return entries;
}

/** 打开后的 MOBI 书籍内容：每章同时给出渲染用 HTML 与抽取用文本（同一 Document 一次产出）。 */
export interface MobiOpenSection {
  /** 净化后的章节 body.innerHTML（阅读器直接渲染） */
  html: string;
  /** 章节纯文本（TTS / 全文搜索 / AI 解读用） */
  text: string;
}

export interface MobiBookContent {
  sections: MobiOpenSection[];
  toc: MobiTocEntry[];
  metadata: MobiBook['metadata'];
}

/**
 * 打开 MOBI / AZW3 二进制并解析全部章节（一次性，换取切章零延迟；
 * MOBI 解压后文本量级与 TXT 全文相当，内存可接受）。
 * mobi.js 按需动态加载——仅打开 MOBI/AZW3 时才下载这部分代码。
 * 任何解析失败（含 DRM 文件头异常）都向上抛错，由阅读器转为人话错误文案。
 */
export async function openMobiBook(data: ArrayBuffer): Promise<MobiBookContent> {
  const { MOBI } = await import('../../vendor/foliate/mobi.js');
  const book = await new MOBI({ unzlib: unzlibAsync }).open(new Blob([data]));
  try {
    const sections: MobiOpenSection[] = [];
    for (const section of book.sections) {
      if (!('createDocument' in section)) continue; // KF8 的 { linear: 'no' } 占位项
      const doc = await section.createDocument();
      sanitizeMobiDoc(doc);
      const html = doc.body ? doc.body.innerHTML : '';
      const text = doc.body ? blockText(doc.body as HTMLElement) : '';
      if (html.trim() || text.trim()) sections.push({ html, text });
    }
    if (sections.length === 0) throw new Error('未找到可阅读的正文');
    return { sections, toc: mobiTocEntries(book), metadata: book.metadata };
  } finally {
    book.destroy();
  }
}
