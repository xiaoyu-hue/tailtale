/**
 * CBZ 图片条目提取单元测试（node:test，jszip 提供 zip，零新依赖）。
 * 运行：npm run test（先把 src 编译到 .test-dist/ 再执行本文件）。
 * 覆盖：过滤非图片条目 / 自然排序（page2 < page10）/ 空包返回空。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCbzImages } from '../.test-dist/modules/reader/cbz.js';

async function makeCbz(entries) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const [name, content] of entries) zip.file(name, content);
  const buf = await zip.generateAsync({ type: 'arraybuffer' });
  return JSZip.loadAsync(buf);
}

test('extractCbzImages 过滤非图片条目并按自然排序（page2 < page10）', async () => {
  const zip = await makeCbz([
    ['page10.png', 'x'],
    ['page2.png', 'x'],
    ['page1.png', 'x'],
    ['comicsinfo.xml', '<x/>'],
    ['readme.txt', 'y'],
    ['cover.jpg', 'y'],
    ['sub/dir/nested.png', 'z'],
  ]);
  const imgs = extractCbzImages(zip);
  // 目录项（sub/dir/nested.png 是 dir=false 的文件，应保留）按自然序；图片在前
  assert.deepEqual(imgs, [
    'cover.jpg',
    'page1.png',
    'page2.png',
    'page10.png',
    'sub/dir/nested.png',
  ]);
});

test('extractCbzImages 空包（仅文本/元数据）返回空数组', async () => {
  const zip = await makeCbz([
    ['comicsinfo.xml', '<comicinfo/>'],
    ['notes.txt', 'x'],
  ]);
  assert.deepEqual(extractCbzImages(zip), []);
});

test('extractCbzImages 忽略目录项', async () => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('p1.png', 'a');
  zip.folder('images'); // 纯目录项，应被忽略
  const buf = await zip.generateAsync({ type: 'arraybuffer' });
  const loaded = await JSZip.loadAsync(buf);
  assert.deepEqual(extractCbzImages(loaded), ['p1.png']);
});
