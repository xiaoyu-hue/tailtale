import type { Book } from './model';
import { readBookContent, readBookBinary } from './service';
import { blockText } from './html-text';
import { openMobiBook } from './mobi';

export interface EpubExtractResult {
  text: string;
  /** 解析失败的章节数（降级：跳过并在结果中明示） */
  failedSections: number;
}

/**
 * 从 EPUB 二进制提取全书文本：经 epubjs 逐节 load/unload（大书懒加载，防内存峰值），
 * 结束后 destroy。整体失败抛 Error（调用方据此降级）。
 * 由 ai 模块的 EPUB 解读与 books 的统一 extractText 共用，单一来源。
 */
export async function extractEpubText(data: ArrayBuffer): Promise<EpubExtractResult> {
  const { default: ePub } = await import('epubjs');
  const instance = ePub(data, { allowScriptedContent: false, allowPopups: false });
  const parts: string[] = [];
  let failedSections = 0;
  try {
    await instance.ready;
    const sections = instance.spine.spine;
    for (const section of sections) {
      try {
        await section.load(instance);
        const text = section.document?.body ? blockText(section.document.body) : '';
        if (text.trim()) parts.push(text);
      } catch {
        failedSections += 1;
      } finally {
        try {
          section.unload();
        } catch {
          // 释放失败不影响主流程
        }
      }
    }
  } finally {
    instance.destroy();
  }
  if (parts.length === 0) throw new Error('EPUB 解析失败');
  return { text: parts.join('\n\n'), failedSections };
}

/** PDF 全书文本提取（pdfjs-dist，按需加载引擎与 worker，零新依赖）。 */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrlMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrlMod.default;
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const parts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = content.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ')
        .trim();
      if (line) parts.push(line);
    }
    return parts.join('\n\n');
  } finally {
    doc.destroy();
  }
}

/**
 * MOBI / AZW3 全书文本提取：与阅读器共用同一解析入口 openMobiBook
 * （vendored foliate-js mobi.js，按需动态加载），取每章 text 字段拼接。
 * 全部章节无文本时抛错（调用方据此降级）。
 */
export async function extractMobiText(data: ArrayBuffer): Promise<string> {
  const { sections } = await openMobiBook(data);
  const parts = sections.map((s) => s.text).filter((t) => t.trim());
  if (parts.length === 0) throw new Error('MOBI 解析失败：未提取到任何文本');
  return parts.join('\n\n');
}

/**
 * 统一正文抽取：修复「二进制格式 readBookContent 返回空」的瓶颈，
 * 让 TTS / 全文搜索 / AI 解读对 EPUB / PDF / MOBI / AZW3 也能拿到文本。
 * - txt 直读；epub（含 FB2 转换产物）经 epubjs 提取；pdf 经 pdfjs 提取；
 *   mobi/azw3 经 vendored foliate-js 提取；
 * - cbz 为图片漫画无文本，返回空。
 */
export async function extractText(book: Book): Promise<string> {
  if (book.format === 'txt') return readBookContent(book.id);
  if (book.format === 'epub') return (await extractEpubText(await readBookBinary(book.id))).text;
  if (book.format === 'pdf') return extractPdfText(await readBookBinary(book.id));
  if (book.format === 'mobi' || book.format === 'azw3')
    return extractMobiText(await readBookBinary(book.id));
  return '';
}
