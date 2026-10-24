/**
 * books 模块书籍模型单元测试（node:test，零新依赖）。
 * 运行：npm run test（先把 books/model.ts 编译到 .test-dist/ 再执行本文件）。
 * 覆盖：nextStatus 三态循环与纯函数性、FORMAT_LABEL / STATUS_LABEL 文案表完整性
 *       （书架角标与状态筛选 UI 消费这两个表，缺键会渲染出空白）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStatus, FORMAT_LABEL, STATUS_LABEL } from '../.test-dist/modules/books/model.js';

test('nextStatus 三态循环：想读 → 在读 → 读完 → 想读', () => {
  assert.equal(nextStatus('want'), 'reading');
  assert.equal(nextStatus('reading'), 'finished');
  assert.equal(nextStatus('finished'), 'want');
});

test('nextStatus 是纯函数：不修改入参、返回新值', () => {
  const input = 'want';
  const output = nextStatus(input);
  assert.equal(input, 'want');
  assert.notEqual(output, input);
});

test('nextStatus 连续调用绕满一圈回到原值', () => {
  let s = 'reading';
  for (let i = 0; i < 3; i++) s = nextStatus(s);
  assert.equal(s, 'reading');
});

test('FORMAT_LABEL 六种格式齐全且文案正确（书架角标渲染来源）', () => {
  assert.deepEqual(FORMAT_LABEL, {
    txt: 'TXT',
    epub: 'EPUB',
    pdf: 'PDF',
    cbz: 'CBZ',
    mobi: 'MOBI',
    azw3: 'AZW3',
  });
});

test('STATUS_LABEL 三种状态齐全且文案正确（状态筛选器渲染来源）', () => {
  assert.deepEqual(STATUS_LABEL, { want: '想读', reading: '在读', finished: '读完' });
});
