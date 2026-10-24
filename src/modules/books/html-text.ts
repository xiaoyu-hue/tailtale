// HTML 正文抽取：从已解析的 Document/元素中按「块级元素」提取纯文本。
// EPUB（epubjs section.document）与 MOBI/AZW3（foliate-js section Document）
// 两个引擎的抽取逻辑共用本文件——TTS / 全文搜索 / AI 解读的文本单一来源。

const HTML_BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th';

/** 取根元素下最顶层块级元素的文本，逐行拼接；无块级元素时退化为整段文本。 */
export function blockText(root: HTMLElement): string {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(HTML_BLOCK_SELECTOR)).filter(
    (el) => el.closest(HTML_BLOCK_SELECTOR) === el
  );
  const source = blocks.length > 0 ? blocks : [root];
  return source
    .map((el) => (el.textContent ?? '').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
