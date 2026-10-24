import JSZip from 'jszip';

export interface Fb2ConvertResult {
  /** 转换后的 EPUB 包体（可直接喂 EpubReader，复用 CFI 书摘 / 进度 / TTS / 搜索 / AI） */
  epub: ArrayBuffer;
  title: string;
  author?: string;
}

interface Chapter {
  title: string;
  xhtml: string;
}

// EPUB 规范要求 mimetype 为首个 entry 且不压缩；固定日期保证转换「确定性」
// （同输入 → 同字节 → 同内容指纹 → 跨设备续读一致、重复导入自动去重）。
const FIXED_DATE = new Date(0);

// 用数字常量代替浏览器全局 Node.TEXT_NODE / Node.ELEMENT_NODE，
// 使 fb2ToEpub 纯函数在 Node（测试，linkedom）与浏览器两端行为一致。
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** FNV-1a 32 位哈希（浏览器与 Node 行为一致），用于生成稳定的 EPUB 唯一标识。 */
function stableHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function textOf(parent: Element | null, tag: string): string {
  const el = parent?.querySelector(tag);
  return el?.textContent?.trim() ?? '';
}

function authorOf(titleInfo: Element | null): string | undefined {
  if (!titleInfo) return undefined;
  const authors = Array.from(titleInfo.querySelectorAll('author'));
  if (authors.length === 0) return undefined;
  const names = authors.map((a) => {
    const last = textOf(a, 'last-name');
    const first = textOf(a, 'first-name');
    const middle = textOf(a, 'middle-name');
    const joined = [first, middle, last].filter(Boolean).join(' ').trim();
    return joined || a.textContent?.trim() || '';
  });
  const result = names.join(' / ').trim();
  return result || undefined;
}

/** 递归内联内容（文本 / emphasis→em / strong / a / 穿透未知内联标签）。image 在正文内忽略（封面单独提取）。 */
function inlineContent(node: Element): string {
  return Array.from(node.childNodes)
    .map((n) => {
      if (n.nodeType === TEXT_NODE) return escapeXml(n.textContent ?? '');
      if (n.nodeType !== ELEMENT_NODE) return '';
      const el = n as Element;
      const tag = el.localName?.toLowerCase();
      if (tag === 'emphasis' || tag === 'em') return `<em>${inlineContent(el)}</em>`;
      if (tag === 'strong' || tag === 'b') return `<strong>${inlineContent(el)}</strong>`;
      if (tag === 'a')
        return `<a href="${escapeXml(
          el.getAttribute('l:href') || el.getAttribute('href') || '#'
        )}">${inlineContent(el)}</a>`;
      if (tag === 'image' || tag === 'strikethrough') return `<s>${inlineContent(el)}</s>`;
      if (tag === 'style' || tag === 'code' || tag === 'sub' || tag === 'sup')
        return `<${tag}>${inlineContent(el)}</${tag}>`;
      return inlineContent(el);
    })
    .join('');
}

/** 块级元素 → XHTML 片段（p / 标题 / 空行 / 诗歌 / 未知块递归为 p）。 */
function elementToXhtml(el: Element): string {
  const tag = el.localName?.toLowerCase();
  if (tag === 'image') return '';
  if (tag === 'empty-line') return '<br/>';
  if (tag === 'poem') {
    const stanzas = Array.from(el.children).filter((c) => c.localName?.toLowerCase() === 'stanza');
    const lines = stanzas.map((st) =>
      Array.from(st.childNodes)
        .map((n) => (n.nodeType === TEXT_NODE ? escapeXml(n.textContent ?? '') : inlineContent(n as Element)))
        .filter(Boolean)
        .join('<br/>')
    );
    return `<p>${lines.join('<br/><br/>')}</p>`;
  }
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag ?? '')) {
    return `<${tag}>${inlineContent(el)}</${tag}>`;
  }
  // p / epigraph / cite / subtitle / text-author / date / 未知块 → 统一 p
  return `<p>${inlineContent(el)}</p>`;
}

/** 把 FB2 的 section 树扁平化为章节列表；嵌套 section 各自成为独立章。 */
function flattenSection(section: Element): Chapter[] {
  const chapters: Chapter[] = [];
  const firstTitle = section.querySelector(':scope > title');
  let title = firstTitle?.textContent?.trim() || '未命名章节';
  const buffer: string[] = [];
  const flush = () => {
    if (buffer.length) {
      chapters.push({ title, xhtml: buffer.join('\n') });
      buffer.length = 0;
    }
  };
  for (const child of Array.from(section.children)) {
    const tag = child.localName?.toLowerCase();
    if (tag === 'title') continue;
    if (tag === 'section') {
      flush();
      chapters.push(...flattenSection(child));
    } else {
      const x = elementToXhtml(child);
      if (x) buffer.push(x);
    }
  }
  flush();
  return chapters;
}

function flattenBody(body: Element): Chapter[] {
  const chapters: Chapter[] = [];
  for (const child of Array.from(body.children)) {
    if (child.localName?.toLowerCase() === 'section') {
      chapters.push(...flattenSection(child));
    } else {
      const x = elementToXhtml(child);
      if (x) chapters.push({ title: '正文', xhtml: x });
    }
  }
  return chapters;
}

function extractCover(
  doc: Document
): { data: string; ext: string } | null {
  const coverImg =
    doc.querySelector('title-info > coverpage > image') ||
    doc.querySelector('coverpage > image');
  if (!coverImg) return null;
  const href = coverImg.getAttribute('l:href') || coverImg.getAttribute('xlink:href') || '';
  const id = href.replace(/^#/, '');
  const binary = Array.from(doc.querySelectorAll('binary')).find((b) => b.getAttribute('id') === id) ?? null;
  if (!binary) return null;
  const ctype = (binary.getAttribute('content-type') || 'image/jpeg').toLowerCase();
  const ext = ctype.includes('png') ? 'png' : ctype.includes('gif') ? 'gif' : 'jpg';
  const b64 = binary.textContent?.trim() ?? '';
  if (!b64) return null;
  return { data: b64, ext };
}

function xhtmlDoc(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh">
<head><meta charset="UTF-8"/><title>${title}</title></head>
<body>
${body}
</body>
</html>`;
}

function buildEpub(opts: {
  title: string;
  author: string;
  lang: string;
  uid: string;
  chapters: Chapter[];
  cover?: { data: string; ext: string } | null;
}): string {
  const { title, author, lang, uid, chapters, cover } = opts;
  const manifest: string[] = [
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
  ];
  const spine: string[] = [];
  const nav: string[] = [];
  const files: Array<{ name: string; content: string }> = [];

  chapters.forEach((ch, i) => {
    const n = i + 1;
    const safe = escapeXml(ch.title);
    files.push({
      name: `OEBPS/c${n}.xhtml`,
      content: xhtmlDoc(safe, `<h1>${safe}</h1>\n${ch.xhtml}`),
    });
    manifest.push(`<item id="c${n}" href="c${n}.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="c${n}"/>`);
    nav.push(
      `<navPoint id="c${n}" playOrder="${n}"><navLabel><text>${safe}</text></navLabel><content src="c${n}.xhtml"/></navPoint>`
    );
  });

  if (cover) {
    const mediaType = cover.ext === 'jpg' ? 'image/jpeg' : cover.ext === 'png' ? 'image/png' : 'image/gif';
    manifest.push(`<item id="cover-img" href="cover.${cover.ext}" media-type="${mediaType}"/>`);
  }

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${title}</dc:title>
    ${author ? `<dc:creator>${author}</dc:creator>` : ''}
    <dc:language>${lang}</dc:language>
    ${cover ? '<meta name="cover" content="cover-img"/>' : ''}
  </metadata>
  <manifest>
    ${manifest.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spine.join('\n    ')}
  </spine>
</package>`;

  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${title}</text></docTitle>
  <navMap>
    ${nav.join('\n    ')}
  </navMap>
</ncx>`;

  const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

  // 返回结构，交给调用方统一写入 zip（保证 mimetype 首位 + STORE + 固定日期）
  return JSON.stringify({ opf, ncx, container, files });
}

/**
 * FB2 → EPUB 纯函数（确定性）。入参为已解析的 FB2 XML Document
 * （浏览器用 DOMParser、Node 测试用 linkedom），便于在两端复用同一逻辑。
 * 输出 EPUB 包体可直接落库为 format:'epub'，复用 EpubReader 的全部能力。
 */
export async function fb2ToEpub(doc: Document): Promise<Fb2ConvertResult> {
  const titleInfo = doc.querySelector('title-info');
  const title = textOf(titleInfo, 'book-title') || '未命名书籍';
  const author = authorOf(titleInfo);
  const lang = textOf(titleInfo, 'lang') || 'zh';

  const body = doc.querySelector('body');
  let chapters = body ? flattenBody(body) : [];
  if (chapters.length === 0 && body) {
    chapters.push({ title: '正文', xhtml: `<p>${inlineContent(body)}</p>` });
  }

  const cover = extractCover(doc);
  const uid = `urn:uuid:fb2-${stableHash(title + '|' + (author ?? ''))}`;

  const struct = JSON.parse(buildEpub({ title: escapeXml(title), author: author ? escapeXml(author) : '', lang, uid, chapters, cover })) as {
    opf: string;
    ncx: string;
    container: string;
    files: Array<{ name: string; content: string }>;
  };

  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE', date: FIXED_DATE });
  zip.file('META-INF/container.xml', struct.container, { date: FIXED_DATE });
  zip.file('OEBPS/content.opf', struct.opf, { date: FIXED_DATE });
  zip.file('OEBPS/toc.ncx', struct.ncx, { date: FIXED_DATE });
  for (const f of struct.files) zip.file(f.name, f.content, { date: FIXED_DATE });
  if (cover) zip.file(`OEBPS/cover.${cover.ext}`, cover.data, { base64: true, date: FIXED_DATE });

  const epub = await zip.generateAsync({ type: 'arraybuffer' });
  return { epub, title, author };
}
