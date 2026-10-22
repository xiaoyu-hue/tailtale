/** 内置公版书库（M7）：副作用层——加载书单、读取并领取书籍。
 * 书籍本体随应用分发（public/library-books/，与主仓库同源），领取不依赖第三方基础设施。
 * 领取后经 hashText 指纹校验，再走与「本地导入」完全相同的数据链路落库。
 *
 * 分发决策：曾计划托管 GitHub raw 按需下载，但 raw.githubusercontent.com 在国内
 * 访问不稳定，「领取」会时灵时不灵，与「本地优先」的项目理念相悖；改为同源分发后，
 * 应用部署到任何静态托管都自带完整书库，指纹校验兜底文件损坏。 */
import { hashText } from '../../platform/hash';
import type { Book } from './model';
import { parseLibraryManifest, type LibraryBook } from './library-model';
import { addBuiltinBook } from './service';

/** 书籍本体基地址：跟随 Vite base（部署在子路径时同样成立）。 */
export const LIBRARY_BASE_URL = `${import.meta.env.BASE_URL}library-books/`;

/** 与 importTxtFile 相同的文本归一化：去 BOM、CRLF/CR → LF。 */
function normalizeText(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

/** 加载随包书单；失败抛出中文原因。 */
export async function fetchLibraryManifest(): Promise<LibraryBook[]> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}library-manifest.json`, {
      cache: 'no-cache',
    });
  } catch {
    throw new Error('书单加载失败：网络异常');
  }
  if (!response.ok) {
    throw new Error('书单加载失败，请刷新重试');
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('书单加载失败：内容不是合法 JSON');
  }
  return parseLibraryManifest(data);
}

/** 领取一本内置书：读取 → 指纹校验 → 落库。校验失败说明文件被篡改或损坏，拒绝入库。
 * 返回落库后的 Book（重复领取时是既有书），供 store 同步。 */
export async function claimBuiltinBook(entry: LibraryBook): Promise<Book> {
  let response: Response;
  try {
    response = await fetch(LIBRARY_BASE_URL + encodeURIComponent(entry.file));
  } catch {
    throw new Error('读取失败：网络异常');
  }
  if (!response.ok) {
    throw new Error('读取失败，请刷新重试');
  }
  const text = normalizeText(await response.text());
  if (hashText(text) !== entry.fingerprint) {
    throw new Error('文件校验失败，可能已损坏，请稍后重试');
  }
  return addBuiltinBook({ title: entry.title, text });
}

export { parseLibraryManifest };
export type { LibraryBook };
