/**
 * 白噪音环境音预设单元测试（node:test，零新依赖）。
 * 运行：npm run test（noise-model.ts 编译到 .test-dist/ 后执行本文件）。
 * 覆盖：四预设结构完整（key/label/src 三元组）、路径形态防手滑、
 * 作者与出处登记齐全（合规四处对齐的数据源）、顺序稳定（UI  chips 顺序即数组序）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOISE_PRESETS } from '../.test-dist/modules/toolbox/noise-model.js';

test('白噪音：恰好四个预设且 key/label 符合既有 UI', () => {
  assert.equal(NOISE_PRESETS.length, 4);
  assert.deepEqual(
    NOISE_PRESETS.map((p) => p.key),
    ['rain', 'waves', 'forest', 'fire'],
  );
  assert.deepEqual(
    NOISE_PRESETS.map((p) => p.label),
    ['雨声', '海浪', '森林', '篝火'],
  );
});

test('白噪音：src 均指向 public/ 下的 mp3 且互不重复', () => {
  for (const p of NOISE_PRESETS) {
    assert.match(p.src, /^audio\/[a-z]+\.mp3$/, `${p.key} 的 src 形态异常: ${p.src}`);
  }
  const srcs = NOISE_PRESETS.map((p) => p.src);
  assert.equal(new Set(srcs).size, srcs.length, '存在重复的音频文件路径');
});

test('白噪音：作者与出处登记齐全（供合规四处对齐使用）', () => {
  for (const p of NOISE_PRESETS) {
    assert.ok(p.author.trim().length > 0, `${p.key} 缺少作者登记`);
    assert.match(p.source, /^https:\/\//, `${p.key} 的出处不是 https 链接`);
  }
});
