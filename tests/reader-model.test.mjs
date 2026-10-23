/**
 * reader 模块章节切分单元测试（node:test，零新依赖）。
 * 运行：npm run test（先把 reader/model.ts 编译到 .test-dist/ 再执行本文件）。
 * 覆盖：splitChapters 的标题识别（中文各体裁 + 英文 Chapter/Prologue/Epilogue）、
 *       无标题整体单章、引首章、offset 首尾相接、空文本、误判防护。
 *       章节目录与滚动定位直接消费 start/end，偏移错一位全文定位都会漂移。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitChapters } from '../.test-dist/modules/reader/model.js';

test('无标题文本 → 整体作为单章「全文」', () => {
  const text = '第一行没有标题。\n第二行也没有。\n';
  const chapters = splitChapters(text);
  assert.equal(chapters.length, 1);
  assert.deepEqual(chapters[0], { title: '全文', start: 0, end: text.length });
});

test('空字符串 → 单章且 end 为 0', () => {
  assert.deepEqual(splitChapters(''), [{ title: '全文', start: 0, end: 0 }]);
});

test('中文标题：第X章 / 第X节 / 第X卷 / 第X回 均识别', () => {
  const text = '第一章 起点\n内容甲\n第二章 途中\n内容乙\n第三卷 终局\n内容丙\n第五回 尾声\n内容丁';
  const chapters = splitChapters(text);
  assert.deepEqual(
    chapters.map((c) => c.title),
    ['第一章 起点', '第二章 途中', '第三卷 终局', '第五回 尾声']
  );
});

test('特殊体裁标题：序章 / 序言 / 前言 / 楔子 / 引子 / 尾声 / 后记 / 番外 / 附录 均识别', () => {
  const titles = ['序章', '序言', '序', '前言', '楔子', '引子', '尾声', '后记', '番外篇 重逢', '附录 年表'];
  for (const title of titles) {
    const chapters = splitChapters(`${title}\n正文`);
    assert.equal(chapters[0].title, title, `应识别标题：${title}`);
  }
});

test('英文标题：Chapter N / Prologue / Epilogue 均识别', () => {
  const text = 'Prologue\nbefore\nChapter 1\nThe start\nChapter 12\nLater\nEpilogue\nThe end';
  const chapters = splitChapters(text);
  assert.deepEqual(
    chapters.map((c) => c.title),
    ['Prologue', 'Chapter 1', 'Chapter 12', 'Epilogue']
  );
});

test('标题前有正文 → 生成「引首」章，边界与第一章 start 相接', () => {
  const prologue = '开场白一段。\n';
  const text = `${prologue}第一章 正文开始`;
  const chapters = splitChapters(text);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].title, '引首');
  assert.equal(chapters[0].start, 0);
  assert.equal(chapters[0].end, prologue.length);
  assert.equal(chapters[1].title, '第一章 正文开始');
  assert.equal(chapters[1].start, prologue.length);
});

test('章节边界首尾相接、末章 end 为全文长度', () => {
  const text = '第一章 甲\naaa\n第二章 乙\nbbb\n第三章 丙\nccc';
  const chapters = splitChapters(text);
  assert.equal(chapters.length, 3);
  for (let i = 0; i < chapters.length - 1; i++) {
    assert.equal(chapters[i].end, chapters[i + 1].start, `第 ${i + 1} 章 end 应与下一章 start 相接`);
  }
  assert.equal(chapters[chapters.length - 1].end, text.length);
  // 每章正文切片可被无重叠地取回，验证 offset 语义（含标题行；
  // end 指向下一标题行起始，故含上一行尾部的换行符）
  assert.equal(text.slice(chapters[1].start, chapters[1].end), '第二章 乙\nbbb\n');
});

test('标题行带首尾空白 / 全角空格 → 仍识别且 title 已 trim', () => {
  const chapters = splitChapters('  第二章  标题  \n正文\n\u3000尾声\u3000\n完');
  assert.equal(chapters[0].title, '第二章  标题');
  assert.equal(chapters[1].title, '尾声');
});

test('普通句子不以「第…」开头误判为标题（句中出现不算）', () => {
  const text = '他说第三章一定会到来。\n然后转身离去。';
  const chapters = splitChapters(text);
  assert.equal(chapters.length, 1);
  assert.equal(chapters[0].title, '全文');
});

test('标题需独占整行：行内还有其他内容则不算', () => {
  const chapters = splitChapters('请见第一章 的内容\n然后继续');
  assert.equal(chapters.length, 1);
});

test('CRLF 文本按 \n 切分，标题仍可识别（offset 含 \r 归上一行）', () => {
  const text = '第一章 甲\r\n内容\r\n第二章 乙\r\n内容';
  const chapters = splitChapters(text);
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].title, '第一章 甲');
  assert.equal(chapters[0].end, chapters[1].start);
  assert.equal(chapters[1].end, text.length);
});
