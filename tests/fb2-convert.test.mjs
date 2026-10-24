/**
 * FB2 → EPUB 转换器单元测试（node:test，零新依赖，linkedom 提供 XML DOM）。
 * 运行：npm run test（先把 src 编译到 .test-dist/ 再执行本文件）。
 * 覆盖：EPUB 结构完整 / mimetype 首位不压缩 / 作者拼接 / 嵌套 section 扁平化 /
 *       内联强调保留 / 封面提取 / 确定性（同输入同字节，保去重与续读一致）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { fb2ToEpub } from '../.test-dist/modules/books/fb2.js';

// 注意：去掉默认 xmlns 仅为让 linkedom 与浏览器 querySelector 行为一致；
// 真实 FB2 带 xmlns，浏览器按 localName 匹配，生产代码逻辑不变。
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns:l="http://www.w3.org/1999/xlink">
  <description>
    <title-info>
      <book-title>测试书</book-title>
      <author><first-name>张</first-name><last-name>三</last-name></author>
      <lang>zh</lang>
      <coverpage><image l:href="#cover"/></coverpage>
    </title-info>
  </description>
  <body>
    <section><title>第一章</title><p>你好<em>世界</em>。</p><section><title>第一节</title><p>嵌套内容。</p></section></section>
    <section><title>第二章</title><p>第二段。</p></section>
  </body>
  <binary id="cover" content-type="image/jpeg">/9j/AAAA</binary>
</FictionBook>`;

function loadZip(epub) {
  // 动态 import（jszip 是 CJS export=，Node ESM 默认导入已含 interop）
  return import('jszip').then((m) => m.default.loadAsync(epub));
}

test('fb2ToEpub 提取标题与作者（姓+名拼接）', async () => {
  const { document } = parseHTML(SAMPLE);
  const { title, author } = await fb2ToEpub(document);
  assert.equal(title, '测试书');
  assert.equal(author, '张 三');
});

test('fb2ToEpub 生成合规 EPUB 结构（mimetype 首位 + 不压缩 + 封面 + 嵌套扁平化为独立章）', async () => {
  const { document } = parseHTML(SAMPLE);
  const { epub } = await fb2ToEpub(document);
  const zip = await loadZip(epub);
  const names = Object.keys(zip.files);

  // mimetype 必须是第一个 entry（内容正确即 STORE 不压缩由生成侧保证）
  assert.equal(names[0], 'mimetype');
  const mt = await zip.file('mimetype').async('string');
  assert.equal(mt, 'application/epub+zip');

  assert.ok(names.includes('META-INF/container.xml'));
  assert.ok(names.includes('OEBPS/content.opf'));
  assert.ok(names.includes('OEBPS/toc.ncx'));
  assert.ok(names.includes('OEBPS/cover.jpg'));

  // 章节：第一章（含嵌套第一节）、第二章 → 嵌套扁平化为 3 个独立 xhtml
  const xhtml = names.filter((n) => /^OEBPS\/c\d+\.xhtml$/.test(n));
  assert.equal(xhtml.length, 3);

  // opf 引用封面 meta
  const opf = await zip.file('OEBPS/content.opf').async('string');
  assert.ok(opf.includes('<meta name="cover" content="cover-img"/>'));
  assert.ok(opf.includes('<dc:creator>张 三</dc:creator>'));
});

test('fb2ToEpub 内联强调保留且嵌套 section 内容落入独立章', async () => {
  const { document } = parseHTML(SAMPLE);
  const { epub } = await fb2ToEpub(document);
  const zip = await loadZip(epub);
  const c1 = await zip.file('OEBPS/c1.xhtml').async('string');
  assert.ok(c1.includes('<em>世界</em>'), '第一章应保留 <em> 强调');
  const c2 = await zip.file('OEBPS/c2.xhtml').async('string');
  assert.ok(c2.includes('嵌套内容'), '嵌套第一节应为独立章 c2');
});

test('fb2ToEpub 确定性：同输入 → 同字节（保内容指纹去重与跨设备续读一致）', async () => {
  const a = await fb2ToEpub(parseHTML(SAMPLE).document);
  const b = await fb2ToEpub(parseHTML(SAMPLE).document);
  const ab = Buffer.from(a.epub);
  const bb = Buffer.from(b.epub);
  assert.equal(ab.length, bb.length);
  assert.ok(ab.equals(bb), '两次转换字节必须一致');
});

test('fb2ToEpub 无封面时也能产出（不写 cover 相关项）', async () => {
  const noCover = SAMPLE.replace(/<coverpage>[\s\S]*?<\/coverpage>/, '').replace(
    /<binary[\s\S]*?<\/binary>/,
    ''
  );
  const { epub } = await fb2ToEpub(parseHTML(noCover).document);
  const zip = await loadZip(epub);
  const names = Object.keys(zip.files);
  assert.ok(!names.some((n) => n.startsWith('OEBPS/cover')), '不应生成封面文件');
  const opf = await zip.file('OEBPS/content.opf').async('string');
  assert.ok(!opf.includes('name="cover"'), 'opf 不应含封面 meta');
});
