/**
 * platform 事件总线单元测试（node:test，零新依赖）。
 * 运行：npm run test（先把 platform/events.ts 编译到 .test-dist/ 再执行本文件）。
 * 覆盖：订阅派发、退订、Set 去重语义、异常隔离（一个监听炸不影响其他监听与发送方）、
 *       事件类型隔离。事件总线是模块间唯一广播通道（架构文档 3.1），
 * 异常隔离失效会让一个模块的 bug 顺着广播炸到全应用。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { on, emit } from '../.test-dist/platform/events.js';

/** 收集指定事件的派发记录，返回 [列表, 退订函数] */
function recorder(event, handler) {
  const list = [];
  const off = on(event, (payload) => {
    list.push(payload);
    if (handler) handler(payload);
  });
  return [list, off];
}

test('订阅后 emit → handler 收到完整 payload', () => {
  const [list, off] = recorder('wallet:changed');
  try {
    emit('wallet:changed', { coins: 120, xp: 30, todayMinutes: 45 });
    assert.equal(list.length, 1);
    assert.deepEqual(list[0], { coins: 120, xp: 30, todayMinutes: 45 });
  } finally {
    off();
  }
});

test('退订后 emit → 不再收到；重复退订无异常', () => {
  const [list, off] = recorder('book:finished');
  emit('book:finished', { bookId: 'a' });
  off();
  off(); // 幂等，不得抛错
  emit('book:finished', { bookId: 'b' });
  assert.equal(list.length, 1);
  assert.equal(list[0].bookId, 'a');
});

test('同一事件多个 handler → 都收到（跨模块广播语义）', () => {
  const [l1, off1] = recorder('checkin:done');
  const [l2, off2] = recorder('checkin:done');
  try {
    emit('checkin:done', { date: '2026-10-23', streak: 3, bonus: 10 });
    assert.equal(l1.length, 1);
    assert.equal(l2.length, 1);
  } finally {
    off1();
    off2();
  }
});

test('同一 handler 重复订阅 → Set 去重，只收一次', () => {
  const list = [];
  const handler = (p) => list.push(p);
  const off1 = on('book:finished', handler);
  const off2 = on('book:finished', handler);
  emit('book:finished', { bookId: 'x' });
  off1();
  off2();
  assert.equal(list.length, 1);
});

test('handler 抛异常 → 不影响其他 handler、emit 本身不抛出', () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  const good = [];
  let offGood;
  let offBad;
  try {
    offBad = on('reading:bond_moment', () => {
      throw new Error('监听器故意炸裂');
    });
    offGood = on('reading:bond_moment', (p) => good.push(p));
    assert.doesNotThrow(() => emit('reading:bond_moment', { bookId: 'b', minutes: 30 }));
    assert.equal(good.length, 1, '异常监听不得阻断后续监听');
    assert.equal(errors.length, 1, '异常应被记录到 console.error');
    assert.match(errors[0], /reading:bond_moment/);
  } finally {
    console.error = originalError;
    offBad();
    offGood();
  }
});

test('事件类型隔离：A 事件的 handler 不收 B 事件', () => {
  const [list, off] = recorder('wallet:changed');
  try {
    emit('checkin:done', { date: '2026-10-23', streak: 1, bonus: 5 });
    assert.equal(list.length, 0);
    emit('wallet:changed', { coins: 1, xp: 1, todayMinutes: 1 });
    assert.equal(list.length, 1);
  } finally {
    off();
  }
});
