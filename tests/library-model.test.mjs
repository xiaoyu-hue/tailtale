/**
 * books 模块内置书库模型单元测试（node:test，零新依赖）。
 * 运行：npm run test（先把 books/library-model.ts 编译到 .test-dist/ 再执行本文件）。
 * 覆盖：parseLibraryManifest 对合法书单 / 非对象 / books 缺失或非数组 /
 *       条目非对象 / 逐字段缺失的判定。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLibraryManifest } from '../.test-dist/books/library-model.js';

const sampleEntry = {
  file: 'hongloumeng.txt',
  title: '红楼梦',
  author: '曹雪芹 / 高鹗',
  dynasty: '清',
  chars: 866904,
  chapters: 121,
  fingerprint: '76d1568da41cf779d3a63',
};

const sampleManifest = { version: 1, books: [sampleEntry] };

test('合法书单 → 返回条目数组且字段原样保留', () => {
  const books = parseLibraryManifest(sampleManifest);
  assert.equal(books.length, 1);
  assert.deepEqual(books[0], sampleEntry);
});

test('空 books 数组 → 合法（返回空列表，板块显示「暂无书籍」之外由 UI 决定）', () => {
  assert.deepEqual(parseLibraryManifest({ version: 1, books: [] }), []);
});

test('非对象内容（null / 数字 / 字符串）→ 抛错', () => {
  for (const bad of [null, 123, 'x', undefined]) {
    assert.throws(() => parseLibraryManifest(bad), /格式不正确/);
  }
});

test('books 字段缺失或非数组 → 抛错', () => {
  assert.throws(() => parseLibraryManifest({ version: 1 }), /books 字段缺失/);
  assert.throws(() => parseLibraryManifest({ books: 'nope' }), /books 字段缺失/);
  assert.throws(() => parseLibraryManifest({ books: {} }), /books 字段缺失/);
});

test('条目非对象（null / 字符串）→ 抛错', () => {
  assert.throws(() => parseLibraryManifest({ books: [null] }), /无效条目/);
  assert.throws(() => parseLibraryManifest({ books: ['红楼梦'] }), /无效条目/);
});

test('条目逐字段缺失或类型错误 → 抛错', () => {
  const cases = [
    { ...sampleEntry, file: '' },
    { ...sampleEntry, file: 42 },
    { ...sampleEntry, title: '' },
    { ...sampleEntry, author: undefined },
    { ...sampleEntry, dynasty: null },
    { ...sampleEntry, chars: '866904' },
    { ...sampleEntry, chars: Number.NaN },
    { ...sampleEntry, chapters: null },
    { ...sampleEntry, fingerprint: '' },
  ];
  for (const bad of cases) {
    assert.throws(() => parseLibraryManifest({ books: [bad] }), /条目字段缺失/);
  }
});

test('多余字段宽容：未知键不影响解析（向前兼容将来的 manifest 扩展）', () => {
  const books = parseLibraryManifest({
    version: 2,
    updatedAt: '2026-10-23',
    books: [{ ...sampleEntry, origin: '内部溯源信息不应进客户端清单' }],
  });
  assert.equal(books.length, 1);
  assert.equal(books[0].title, '红楼梦');
});

test('首条合法、次条损坏 → 整体抛错（宁缺毋滥，不上半截书单）', () => {
  assert.throws(
    () => parseLibraryManifest({ books: [sampleEntry, { ...sampleEntry, fingerprint: '' }] }),
    /条目字段缺失/
  );
});
