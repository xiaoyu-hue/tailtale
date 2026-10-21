/**
 * ai 模块领域模型单元测试（node:test，零新依赖）。
 * 运行：npm run test（先把 pet/ai 两个 model.ts 编译到 .test-dist/ 再执行本文件）。
 * 覆盖：token 估算、章节分组（换行断组/硬切/截断）、三个 prompt builder、
 * 费用预估算术、错误映射（全错误码）、URL 拼接、配置校验。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_SYSTEM_PROMPT,
  AiError,
  DEEPSEEK_PRESET,
  GROUP_RULES,
  aiErrorFromStatus,
  buildAskPrompt,
  buildChunkSummaryPrompt,
  buildOutlinePrompt,
  chatCompletionsUrl,
  defaultAiConfig,
  describeAiError,
  estimateExplainCost,
  estimateTokens,
  groupText,
  isAiConfigured,
} from '../.test-dist/ai/model.js';

// ---- 配置校验 ----

test('isAiConfigured：三字段非空才算配置', () => {
  assert.equal(isAiConfigured(defaultAiConfig()), false);
  assert.equal(isAiConfigured({ baseUrl: '  ', apiKey: '  ', model: '  ' }), false);
  assert.equal(isAiConfigured({ baseUrl: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-chat' }), false);
  assert.equal(isAiConfigured(DEEPSEEK_PRESET.baseUrl ? { ...DEEPSEEK_PRESET, apiKey: 'sk-x' } : defaultAiConfig()), true);
});

// ---- token 估算 ----

test('estimateTokens：纯中文一字一 token', () => {
  assert.equal(estimateTokens('中'.repeat(100)), 100);
});

test('estimateTokens：ASCII 约 4 字符一 token', () => {
  assert.equal(estimateTokens('a'.repeat(400)), 100);
  assert.equal(estimateTokens('abcd'), 1);
});

test('estimateTokens：中文标点计入 CJK', () => {
  // 「中文标点，。！」共 7 个字符（4 汉字 + 3 全角标点），全部落在 CJK 码位区间
  assert.equal(estimateTokens('中文标点，。！'), 7);
});

test('estimateTokens：混合文本与空串', () => {
  assert.equal(estimateTokens('中文abc'), 3); // 2 CJK + ceil(3/4)
  assert.equal(estimateTokens(''), 0);
});

// ---- 章节分组 ----

test('groupText：短文本单组全覆盖', () => {
  const text = '第一行\n第二行\n第三行';
  const result = groupText(text);
  assert.equal(result.groups.length, 1);
  assert.equal(result.truncated, false);
  assert.equal(result.groups[0].title, '第一行');
  assert.equal(result.groups[0].text, text);
});

test('groupText：长文本多组，拼接还原原文（未截断时）', () => {
  const lines = Array.from({ length: 300 }, (_, i) => `第${i}行`.padEnd(100, '内'));
  const text = lines.join('\n');
  const result = groupText(text);
  assert.ok(result.groups.length > 1, '应分成多组');
  assert.equal(result.truncated, false);
  assert.equal(result.groups.map((g) => g.text).join('\n'), text);
  assert.equal(result.coveredChars, text.length - (result.groups.length - 1));
  for (const group of result.groups) {
    assert.ok(group.text.length <= GROUP_RULES.TARGET_CHARS + 100, '每组不超目标（含行长余量）');
    assert.ok(group.title.length > 0);
  }
});

test('groupText：超过 MAX_GROUPS 截断', () => {
  const lines = Array.from({ length: 2000 }, (_, i) => `第${i}行`.padEnd(100, '容'));
  const text = lines.join('\n');
  const result = groupText(text);
  assert.equal(result.groups.length, GROUP_RULES.MAX_GROUPS);
  assert.equal(result.truncated, true);
  assert.ok(result.coveredChars < text.length);
});

test('groupText：单行超长硬切', () => {
  const text = 'x'.repeat(25000);
  const result = groupText(text);
  assert.equal(result.truncated, false);
  assert.equal(result.groups.length, 4); // 8000*3 + 1000
  for (const group of result.groups) assert.ok(group.text.length <= GROUP_RULES.TARGET_CHARS);
  assert.equal(result.groups.map((g) => g.text).join(''), text);
});

test('groupText：组标题取首行，无有效首行则第 N 段', () => {
  const result = groupText('x'.repeat(25000));
  assert.equal(result.groups[0].title, `${'x'.repeat(20)}…`);
  assert.equal(groupText('\n\n\nabc').groups[0].title, 'abc');
});

// ---- prompt builder ----

test('buildChunkSummaryPrompt：含书名、序号与原文', () => {
  const prompt = buildChunkSummaryPrompt('测试书', { index: 0, title: '开局', text: '正文内容' }, 3);
  assert.match(prompt, /《测试书》/);
  assert.match(prompt, /第 1\/3 部分/);
  assert.match(prompt, /开局/);
  assert.match(prompt, /正文内容/);
  assert.match(prompt, /150 字以内/);
});

test('buildOutlinePrompt：含书名、字数与全部摘要', () => {
  const prompt = buildOutlinePrompt('测试书', ['摘要一', '摘要二'], 50000);
  assert.match(prompt, /《测试书》/);
  assert.match(prompt, /约 50000 字/);
  assert.match(prompt, /摘要一/);
  assert.match(prompt, /摘要二/);
  assert.match(prompt, /—— 第 2 部分摘要 ——/);
});

test('buildAskPrompt：含大纲、问题与不得编造约束', () => {
  const prompt = buildAskPrompt('测试书', '大纲文本', '主角是谁');
  assert.match(prompt, /大纲文本/);
  assert.match(prompt, /主角是谁/);
  assert.match(prompt, /不得编造/);
  assert.match(prompt, /300 字以内/);
});

test('AI_SYSTEM_PROMPT：固定读书助手人设', () => {
  assert.match(AI_SYSTEM_PROMPT, /读书助手/);
  assert.match(AI_SYSTEM_PROMPT, /简体中文/);
});

// ---- 费用预估 ----

test('estimateExplainCost：小书单遍调用', () => {
  const cost = estimateExplainCost('中'.repeat(1000));
  assert.equal(cost.calls, 1);
  assert.equal(cost.truncated, false);
  assert.equal(cost.totalChars, 1000);
  assert.equal(cost.inputTokens, 1000 + 300); // 文本 + prompt 开销
  assert.equal(cost.outputTokens, 800);
  // 1000+300 in × ¥2/M + 800 out × ¥8/M = 0.009 → 0.01
  assert.equal(cost.feeYuan, 0.01);
});

test('estimateExplainCost：大书 map-reduce 多调用', () => {
  const cost = estimateExplainCost('中'.repeat(30000));
  assert.equal(cost.calls, 5); // 4 组（8000×3 + 6000）+ 1 次合并
  assert.equal(cost.truncated, false);
  assert.equal(cost.inputTokens, 30000 + 5 * 300); // 全文 30000 token + 5 次 prompt 开销
  assert.equal(cost.outputTokens, 4 * 400 + 800);
  // 31500 in × ¥2/M + 2400 out × ¥8/M = 0.0822 → 0.08
  assert.equal(cost.feeYuan, 0.08);
});

test('estimateExplainCost：超 16 万字截断标记', () => {
  const cost = estimateExplainCost('中'.repeat(200000));
  assert.equal(cost.truncated, true);
  assert.equal(cost.calls, GROUP_RULES.MAX_GROUPS + 1);
});

// ---- 错误映射 ----

test('aiErrorFromStatus：各状态码命中预期 code', () => {
  assert.equal(aiErrorFromStatus(400).code, 'bad-request');
  assert.equal(aiErrorFromStatus(401).code, 'unauthorized');
  assert.equal(aiErrorFromStatus(403).code, 'forbidden');
  assert.equal(aiErrorFromStatus(404).code, 'not-found');
  assert.equal(aiErrorFromStatus(413).code, 'payload-too-large');
  assert.equal(aiErrorFromStatus(429).code, 'rate-limited');
  assert.equal(aiErrorFromStatus(500).code, 'server-error');
  assert.equal(aiErrorFromStatus(503).code, 'server-error');
  assert.equal(aiErrorFromStatus(418).code, 'unknown');
  for (const status of [400, 401, 403, 404, 413, 429, 500, 418]) {
    const error = aiErrorFromStatus(status);
    assert.ok(error.message.length > 0, 'message 非空');
    assert.ok(error.hint.length > 0, 'hint 非空');
  }
});

test('describeAiError：AiError 原样透传', () => {
  const info = describeAiError(new AiError('no-outline', '尚未生成本书大纲', '请先生成大纲'));
  assert.equal(info.code, 'no-outline');
  assert.equal(info.message, '尚未生成本书大纲');
  assert.equal(info.hint, '请先生成大纲');
});

test('describeAiError：AbortError → 超时', () => {
  const aborted = new Error('The operation was aborted');
  aborted.name = 'AbortError';
  const info = describeAiError(aborted);
  assert.equal(info.code, 'timeout');
  assert.match(info.hint, /网络|代理|端点/);
});

test('describeAiError：TypeError → 网络或 CORS', () => {
  const info = describeAiError(new TypeError('Failed to fetch'));
  assert.equal(info.code, 'cors-or-network');
  assert.match(info.hint, /CORS/);
});

test('describeAiError：普通 Error 与未知值兜底', () => {
  const info = describeAiError(new Error('boom'));
  assert.equal(info.code, 'unknown');
  assert.equal(info.message, 'boom');
  const fallback = describeAiError('not-an-error');
  assert.equal(fallback.code, 'unknown');
  assert.ok(fallback.message.length > 0);
});

// ---- URL ----

test('chatCompletionsUrl：容忍尾斜杠、空白与 /v1', () => {
  assert.equal(chatCompletionsUrl('https://api.deepseek.com'), 'https://api.deepseek.com/chat/completions');
  assert.equal(chatCompletionsUrl('https://api.deepseek.com/'), 'https://api.deepseek.com/chat/completions');
  assert.equal(chatCompletionsUrl('https://api.deepseek.com/v1'), 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(chatCompletionsUrl('  https://api.deepseek.com/v1/  '), 'https://api.deepseek.com/v1/chat/completions');
});
