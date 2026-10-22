/**
 * shared/dates 单元测试（node:test，零新依赖）。
 * 运行：npm run test（package.json 的 test 脚本先把 dates.ts 单文件编译到
 * .test-dist/shared/ 再执行本文件）。
 * 覆盖：展示用完整日期（formatDateLabel：跨月/周末/前导零行为）与日期键平移
 * （shiftDay：跨月、跨年、闰日边界——打卡与宠物每日计数均依赖它）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateLabel,
  formatKey,
  greetingForHour,
  shiftDay,
  todayKey,
} from '../.test-dist/shared/dates.js';

test('formatDateLabel：2026-10-22 输出 2026年10月22日 周四', () => {
  // 2026-10-22 是周四（本地时区构造，避免 UTC 偏移）
  assert.equal(formatDateLabel(new Date(2026, 9, 22, 11, 59)), '2026年10月22日 周四');
});

test('formatDateLabel：个位月日不带前导零', () => {
  assert.equal(formatDateLabel(new Date(2026, 0, 5, 0, 0)), '2026年1月5日 周一');
});

test('formatDateLabel：周日与周六标签正确', () => {
  assert.equal(formatDateLabel(new Date(2026, 9, 25)), '2026年10月25日 周日'); // 周日
  assert.equal(formatDateLabel(new Date(2026, 9, 24)), '2026年10月24日 周六'); // 周六
});

test('formatKey / todayKey：本地时区日期键', () => {
  assert.equal(formatKey(new Date(2026, 9, 22, 23, 59)), '2026-10-22');
  assert.equal(formatKey(new Date(2026, 9, 22, 0, 1)), '2026-10-22');
  assert.equal(todayKey(new Date(2026, 11, 31, 12, 0)), '2026-12-31');
});

test('shiftDay：跨月向前向后', () => {
  assert.equal(shiftDay('2026-10-01', -1), '2026-09-30');
  assert.equal(shiftDay('2026-10-31', 1), '2026-11-01');
});

test('shiftDay：跨年与闰日边界', () => {
  assert.equal(shiftDay('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDay('2024-02-28', 1), '2024-02-29'); // 闰年
  assert.equal(shiftDay('2026-02-28', 1), '2026-03-01'); // 平年
});

test('greetingForHour：六个时段全覆盖且边界正确', () => {
  assert.equal(greetingForHour(0), '夜深了');
  assert.equal(greetingForHour(4), '夜深了');
  assert.equal(greetingForHour(5), '早上好');
  assert.equal(greetingForHour(7), '早上好');
  assert.equal(greetingForHour(8), '上午好');
  assert.equal(greetingForHour(10), '上午好');
  assert.equal(greetingForHour(11), '中午好');
  assert.equal(greetingForHour(12), '中午好');
  assert.equal(greetingForHour(13), '下午好');
  assert.equal(greetingForHour(17), '下午好');
  assert.equal(greetingForHour(18), '晚上好');
  assert.equal(greetingForHour(22), '晚上好');
  assert.equal(greetingForHour(23), '夜深了');
});
