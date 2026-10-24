/**
 * MOBI / AZW3 解析适配单元测试（node:test）。
 * 运行：npm run test（先把 src 编译到 .test-dist/ 再执行本文件）。
 * 环境：linkedom 提供 DOMParser / document 垫片（mobi.js 依赖浏览器 DOM）；
 *       XMLSerializer 垫永不执行的壳（createDocument 路径不序列化）。
 * 覆盖：MOBI6 单节解析 / pagebreak 多节 / HTML 净化（脚本、on*、kindle 图片、
 *       javascript: 链接）/ 目录归一化（两类引擎形状）/ 损坏文件抛错 /
 *       extractMobiText 全文抽取（TTS / 搜索 / AI 的数据来源）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser, parseHTML } from 'linkedom';

// linkedom 不导出 XMLSerializer；mobi.js 类字段初始化会 new XMLSerializer()，
// 但 createDocument 路径不调用序列化——垫一个永不执行的壳。
globalThis.XMLSerializer = class XMLSerializer {
  serializeToString() {
    throw new Error('XMLSerializer shim: 测试路径不应调用序列化');
  }
};
globalThis.DOMParser = DOMParser;
globalThis.document = parseHTML('').document;

const { openMobiBook, sanitizeMobiDoc, mobiTocEntries } = await import('../.test-dist/modules/books/mobi.js');

// ---- 最小 MOBI6 样本构造（无压缩 compression=1，字节序大端） ----

function writeString(arr, offset, s) {
  arr.set(new TextEncoder().encode(s), offset);
}

/** record 0 = 16 字节 PalmDOC 头 + 264 字节 MOBI 头 + 标题；版本 6 → MOBI6 引擎。 */
function buildRecord0(titleBytes, numTextRecords) {
  const record0 = new Uint8Array(280 + titleBytes.length);
  const dv = new DataView(record0.buffer);
  dv.setUint16(0, 1); // compression = 1（不压缩）
  dv.setUint16(8, numTextRecords);
  dv.setUint16(10, 4096); // recordSize
  dv.setUint16(12, 0); // encryption = 0
  writeString(record0, 16, 'MOBI');
  dv.setUint32(20, 264); // MOBI 头长度
  dv.setUint32(24, 2); // type = book
  dv.setUint32(28, 65001); // encoding = utf-8
  dv.setUint32(32, 12345); // uid
  dv.setUint32(36, 6); // version 6 → MOBI6
  dv.setUint32(84, 280); // titleOffset（相对 record 0 起点）
  dv.setUint32(88, titleBytes.length);
  record0[94] = 0; // localeRegion
  record0[95] = 9; // localeLanguage
  dv.setUint32(108, numTextRecords + 1); // resourceStart
  dv.setUint32(112, 0xffffffff); // huffcdic
  dv.setUint32(116, 0); // numHuffcdic
  dv.setUint32(128, 0); // exthFlag = 0（无 EXTH）
  dv.setUint32(240, 0); // trailingFlags
  dv.setUint32(244, 0xffffffff); // indx
  record0.set(titleBytes, 280);
  return record0;
}

function buildMobi(html) {
  const titleBytes = new TextEncoder().encode('测试书');
  const textBytes = new TextEncoder().encode(html);
  const record0 = buildRecord0(titleBytes, 1);

  // PDB：78 字节头 + 记录信息表 + record0 + 1 个文本记录
  const numRecords = 2;
  const headerSize = 78 + numRecords * 8;
  const offsets = [headerSize, headerSize + record0.length];
  const out = new Uint8Array(offsets[1] + textBytes.length);
  const dv = new DataView(out.buffer);
  writeString(out, 60, 'BOOK');
  writeString(out, 64, 'MOBI');
  dv.setUint16(76, numRecords);
  for (let i = 0; i < numRecords; i++) dv.setUint32(78 + i * 8, offsets[i]);
  out.set(record0, offsets[0]);
  out.set(textBytes, offsets[1]);
  return out.buffer;
}

const SINGLE_HTML =
  '<html><head><title>测试书</title></head><body><h1>第一章</h1><p>你好世界。</p></body></html>';
const TWO_PAGE_HTML =
  '<html><body><h1>第一章</h1><p>你好世界。</p></body></html>' +
  '<mbp:pagebreak/>' +
  '<html><body><h1>第二章</h1><p>第二段内容。</p></body></html>';

test('openMobiBook：单节解析出正文 HTML 与纯文本，metadata 带出标题', async () => {
  const book = await openMobiBook(buildMobi(SINGLE_HTML));
  assert.equal(book.sections.length, 1);
  assert.match(book.sections[0].html, /<h1>第一章<\/h1>/);
  assert.match(book.sections[0].html, /你好世界。/);
  assert.match(book.sections[0].text, /你好世界。/);
  assert.equal(book.metadata?.title, '测试书');
});

test('openMobiBook：mbp:pagebreak 切分为多节', async () => {
  const book = await openMobiBook(buildMobi(TWO_PAGE_HTML));
  assert.equal(book.sections.length, 2);
  assert.match(book.sections[0].text, /你好世界。/);
  assert.match(book.sections[1].text, /第二段内容。/);
});

test('openMobiBook：净化 script / on* / kindle 图片 / javascript: 链接', async () => {
  const dirty =
    '<html><body>' +
    '<p onclick="alert(1)">正文</p>' +
    '<script>alert(2)</script>' +
    '<img src="kindle:embed:0001"/>' +
    '<a href="javascript:alert(3)">坏链接</a>' +
    '<iframe src="https://evil.example"></iframe>' +
    '</body></html>';
  const book = await openMobiBook(buildMobi(dirty));
  const html = book.sections[0].html;
  assert.ok(!/<script/i.test(html), 'script 必须被移除');
  assert.ok(!/onclick/i.test(html), 'on* 事件属性必须被剥离');
  assert.ok(!/<img/i.test(html), 'kindle 图片必须被移除');
  assert.ok(!/javascript:/i.test(html), 'javascript: 链接必须被剥离');
  assert.ok(!/<iframe/i.test(html), 'iframe 必须被移除');
  assert.match(html, /正文/);
  assert.match(html, /坏链接/); // 链接文本保留，仅去协议
});

test('openMobiBook：损坏文件抛错（DRM / 非 MOBI 文件由阅读器转人话文案）', async () => {
  await assert.rejects(() => openMobiBook(new Uint8Array(200).buffer), /Record index out of bounds|Missing MOBI header|Unknown compression/);
});

test('mobiTocEntries：MOBI6 形状（<a filepos> 元素）归一化', async () => {
  const book = await openMobiBook(buildMobi(TWO_PAGE_HTML));
  // 手工给 sections[0] 的 Document 挂 reference 无法走通 init 流程，
  // 这里直接构造 MOBI6 形状的 toc（与 mobi.js 产出同构：<a filepos="N"> 元素列表）
  const doc = new DOMParser().parseFromString(
    '<html><body><a filepos="0">开始</a><a filepos="20">跳转</a></body></html>',
    'text/html'
  );
  const fakeBook = {
    toc: Array.from(doc.querySelectorAll('a')),
    resolveHref: (href) => ({ index: Number(href.match(/filepos:(.*)/)[1]) > 0 ? 1 : 0 }),
  };
  const entries = mobiTocEntries(fakeBook);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].label, '开始');
  assert.equal(entries[0].index, 0);
  assert.equal(entries[1].label, '跳转');
  assert.equal(entries[1].index, 1);
  // 真书的 sections 不含 toc 属性污染
  assert.equal(book.sections.length, 2);
});

test('mobiTocEntries：KF8 形状（对象树 + subitems 扁平化 + kindle:pos 映射）', () => {
  const fakeBook = {
    toc: [
      { label: '第一章', href: 'kindle:pos:fid:0001:off:0000000000', subitems: [
        { label: '第一节', href: 'kindle:pos:fid:0002:off:0000000000' },
      ] },
      { label: '无法定位', href: '' },
    ],
    getIndexByFID: (fid) => fid - 1,
  };
  const entries = mobiTocEntries(fakeBook);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], { label: '第一章', index: 0, level: 0 });
  assert.deepEqual(entries[1], { label: '第一节', index: 1, level: 1 });
  assert.equal(entries[2].index, -1); // href 为空 → 无法定位
});

test('openMobiBook：每章 text 为纯文本（extractMobiText 的消费源，TTS/搜索/AI 同源）', async () => {
  const book = await openMobiBook(buildMobi(TWO_PAGE_HTML));
  const text = book.sections.map((s) => s.text).join('\n\n');
  assert.match(text, /你好世界。/);
  assert.match(text, /第二段内容。/);
  assert.ok(!/<[a-z]/i.test(text), 'text 应为纯文本（extractMobiText 即拼接各章 text）');
});

test('sanitizeMobiDoc：可直接对 Document 调用（阅读器渲染前净化）', () => {
  const doc = new DOMParser().parseFromString(
    '<html><body><p>正文</p><script>alert(1)</script><a href="javascript:x">链接</a></body></html>',
    'text/html'
  );
  sanitizeMobiDoc(doc);
  const html = doc.body.innerHTML;
  assert.ok(!/<script/i.test(html));
  assert.ok(!/javascript:/i.test(html));
  assert.match(html, /正文/);
});
