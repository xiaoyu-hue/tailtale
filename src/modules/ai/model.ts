/**
 * ai 模块领域模型：AI 解读书（M5）。
 * 纯数据 + 纯函数，零 import、零 DOM 依赖（可单测，见 tests/ai-model.test.mjs）。
 *
 * 合规红线（docs/书时-开源组件与合规.md）：
 * - 本文件及整个 ai 模块禁止出现上传、传输、转发用户密钥的逻辑；
 * - 密钥只随请求发往用户自行配置的端点（BYOK），书时定位为"工具提供者"；
 * - 禁止硬编码任何密钥。
 */

/** DeepSeek 官方预设（PRD §5.3 / 技术栈 §3.3：浏览器直连，已实测支持 CORS）。 */
export const DEEPSEEK_PRESET = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
} as const;

export interface AiConfig {
  /** OpenAI 兼容端点 base url，如 https://api.deepseek.com（可含 /v1） */
  baseUrl: string;
  /** 用户自己的 API Key，仅存本机浏览器，禁上传 */
  apiKey: string;
  /** 模型名，如 deepseek-chat */
  model: string;
}

export function defaultAiConfig(): AiConfig {
  return { baseUrl: '', apiKey: '', model: '' };
}

/** 三字段 trim 后均非空才算已配置。 */
export function isAiConfigured(config: AiConfig): boolean {
  return (
    config.baseUrl.trim().length > 0 &&
    config.apiKey.trim().length > 0 &&
    config.model.trim().length > 0
  );
}

// ---- token 估算 ----

/** CJK 统一表意文字 + 中文标点 + 全角字符：BPE 下大体一字一 token。 */
function isCjkCode(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK 基本区
    (code >= 0x3400 && code <= 0x4dbf) || // CJK 扩展 A
    (code >= 0x3000 && code <= 0x303f) || // 中文标点
    (code >= 0xff00 && code <= 0xffef) // 全角字符
  );
}

/**
 * 粗估文本 token 数：CJK 一字一 token，其余约 4 字符一 token。
 * 刻意偏高估——费用预警宁多勿少，避免用户被账面价格惊吓。
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (isCjkCode(code)) cjk += 1;
    else other += 1;
  }
  return cjk + Math.ceil(other / 4);
}

// ---- 章节分组 ----

export const GROUP_RULES = {
  /** 每组目标字符数（按行累积，断点落在换行） */
  TARGET_CHARS: 8000,
  /** 最多组数；超出部分截断（约覆盖 16 万字），结果中明示 */
  MAX_GROUPS: 20,
  /** 不超过此长度单遍直读全文（1 次调用），否则走 map-reduce */
  SINGLE_PASS_CHARS: 24000,
} as const;

export interface TextGroup {
  index: number;
  /** 组标题：取组内首行（截断），无有效首行则为「第 N 段」 */
  title: string;
  text: string;
}

export interface GroupResult {
  groups: TextGroup[];
  /** 是否因超过 MAX_GROUPS 被截断 */
  truncated: boolean;
  /** 实际覆盖的字符数 */
  coveredChars: number;
}

/** 组标题：组内首个非空行，截到 20 字。 */
function titleFromGroup(text: string, index: number): string {
  const firstLine = text.split('\n', 1)[0]?.trim() ?? '';
  if (!firstLine) return `第 ${index + 1} 段`;
  return firstLine.length > 20 ? `${firstLine.slice(0, 20)}…` : firstLine;
}

/**
 * 把全书文本按行累积切成若干组（断点落在换行，单行超长则硬切）。
 * 纯函数：同样输入永远得到同样分组，便于测试与复现。
 */
export function groupText(
  text: string,
  targetChars: number = GROUP_RULES.TARGET_CHARS,
  maxGroups: number = GROUP_RULES.MAX_GROUPS,
): GroupResult {
  const groups: TextGroup[] = [];
  const lines = text.split('\n');
  let buffer = '';
  let covered = 0;
  let truncated = false;

  const flush = (): void => {
    if (!buffer) return;
    const index = groups.length;
    groups.push({ index, title: titleFromGroup(buffer, index), text: buffer });
    covered += buffer.length;
    buffer = '';
  };

  for (const line of lines) {
    if (groups.length >= maxGroups) {
      truncated = true;
      break;
    }
    // 单行超长：按 targetChars 硬切（EPUB 提取的文本可能没有换行）
    if (line.length > targetChars) {
      flush();
      for (let start = 0; start < line.length; start += targetChars) {
        if (groups.length >= maxGroups) {
          truncated = true;
          break;
        }
        const piece = line.slice(start, start + targetChars);
        const index = groups.length;
        groups.push({ index, title: titleFromGroup(piece, index), text: piece });
        covered += piece.length;
      }
      continue;
    }
    if (buffer && buffer.length + line.length + 1 > targetChars) flush();
    buffer = buffer ? `${buffer}\n${line}` : line;
  }
  if (!truncated) flush();

  return { groups, truncated, coveredChars: covered };
}

// ---- prompt ----

/** system 角色：书时读书助手，简体中文纯文本（规避 Markdown 标题渲染问题）。 */
export const AI_SYSTEM_PROMPT =
  '你是「书时」应用内的读书助手，只依据用户提供的书籍材料作答。始终使用简体中文，输出纯文本，不要使用 Markdown 标题语法，可用数字编号分行。';

/** 第一阶段：单个分组的结构化摘要（map）。 */
export function buildChunkSummaryPrompt(
  bookTitle: string,
  group: TextGroup,
  groupCount: number,
): string {
  return [
    `以下是你正在辅助解读的书籍《${bookTitle}》的第 ${group.index + 1}/${groupCount} 部分`,
    `（标题：${group.title}）。请用 150 字以内概括本部分的主要内容与关键信息，保留专有名词：`,
    '',
    group.text,
  ].join('\n');
}

/** 第二阶段：把各部分摘要合并为全书大纲（reduce）。 */
export function buildOutlinePrompt(
  bookTitle: string,
  parts: string[],
  totalChars: number,
): string {
  return [
    `请根据以下材料，为《${bookTitle}》（全文约 ${totalChars} 字）生成全书大纲。要求：`,
    '1) 先给一句话全书概述；',
    '2) 按内容结构分级列出（不超过三级）；',
    '3) 末尾用三句话总结核心。',
    '',
    '材料：',
    ...parts.map((part, i) => `—— 第 ${i + 1} 部分摘要 ——\n${part}`),
  ].join('\n\n');
}

/** 提问：以已生成大纲为上下文；大纲未覆盖的细节必须明说，不得编造。 */
export function buildAskPrompt(bookTitle: string, outline: string, question: string): string {
  return [
    `以下是《${bookTitle}》的全书大纲：`,
    '',
    outline,
    '',
    `用户提问：${question}`,
    '请仅依据上述大纲与常识回答，300 字以内；大纲未覆盖的细节须明说「大纲中未覆盖此细节，建议阅读对应章节」，不得编造。',
  ].join('\n');
}

// ---- 费用预估 ----

/**
 * 参考单价（元/百万 token）。DeepSeek 缓存未命中口径，刻意取高。
 * 注意：价格随官方调整，估算仅作预警，以 DeepSeek 官网实时价为准。
 */
export const REFERENCE_PRICE = {
  currency: 'CNY',
  inputPerMillion: 2,
  outputPerMillion: 8,
  note: '2026-10 参考价（缓存未命中口径，宁高勿低），以 DeepSeek 官网实时价为准',
} as const;

/** 输出 token 预估值（按次）：分组摘要 / 全书大纲 / 单次回答。 */
export const OUTPUT_TOKEN_ESTIMATE = {
  chunk: 400,
  outline: 800,
  answer: 600,
} as const;

/** 每次调用的 prompt 固定开销（system + 指令），粗估。 */
export const PROMPT_OVERHEAD_TOKENS = 300;

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  /** 预计 API 调用次数（map-reduce 为组数 + 1） */
  calls: number;
  /** 预估费用（元，两位小数） */
  feeYuan: number;
  truncated: boolean;
  totalChars: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 预估一次「生成全书大纲」的 token 与费用（PRD §5.3 成本控制）。 */
export function estimateExplainCost(text: string): CostEstimate {
  const totalChars = text.length;
  const singlePass = totalChars <= GROUP_RULES.SINGLE_PASS_CHARS;
  const groups = singlePass ? [] : groupText(text).groups;
  const truncated = singlePass ? false : groups.length >= GROUP_RULES.MAX_GROUPS;

  const inputTokens =
    (singlePass
      ? estimateTokens(text)
      : groups.reduce((sum, g) => sum + estimateTokens(g.text), 0)) +
    (singlePass ? 1 : groups.length + 1) * PROMPT_OVERHEAD_TOKENS;
  const outputTokens = singlePass
    ? OUTPUT_TOKEN_ESTIMATE.outline
    : groups.length * OUTPUT_TOKEN_ESTIMATE.chunk + OUTPUT_TOKEN_ESTIMATE.outline;

  const feeYuan = round2(
    (inputTokens / 1_000_000) * REFERENCE_PRICE.inputPerMillion +
      (outputTokens / 1_000_000) * REFERENCE_PRICE.outputPerMillion,
  );

  return {
    inputTokens,
    outputTokens,
    calls: singlePass ? 1 : groups.length + 1,
    feeYuan,
    truncated,
    totalChars,
  };
}

// ---- 错误映射 ----

export type AiErrorCode =
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'payload-too-large'
  | 'rate-limited'
  | 'server-error'
  | 'cors-or-network'
  | 'timeout'
  | 'aborted'
  | 'empty-response'
  | 'epub-extract-failed'
  | 'book-missing'
  | 'not-configured'
  | 'no-outline'
  | 'unknown';

/** AI 调用错误：message 给用户看，hint 给修复步骤（调试三步的 UI 落地）。 */
export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly hint: string;

  constructor(code: AiErrorCode, message: string, hint: string) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.hint = hint;
  }
}

/** HTTP 状态码 → AiError（OpenAI 兼容协议通用语义）。 */
export function aiErrorFromStatus(status: number): AiError {
  if (status === 400)
    return new AiError('bad-request', '请求被拒绝（400）', '检查模型名与自定义端点是否兼容 OpenAI 协议');
  if (status === 401)
    return new AiError('unauthorized', '密钥无效或未授权（401）', '检查 api_key 是否填错、有无前后空格；可去 DeepSeek 平台重新创建');
  if (status === 403)
    return new AiError('forbidden', '密钥无权访问（403）', '确认该密钥有调用权限，未被平台禁用');
  if (status === 404)
    return new AiError('not-found', '接口地址不存在（404）', '检查 base_url 与 model 字段是否正确');
  if (status === 413)
    return new AiError('payload-too-large', '内容超出模型上下文上限（413）', '换用支持更长上下文的模型');
  if (status === 429)
    return new AiError('rate-limited', '请求过频或额度不足（429）', '稍后再试；并到平台检查账户余额');
  if (status >= 500)
    return new AiError('server-error', '模型服务暂时故障', '服务端临时问题，稍后重试');
  return new AiError('unknown', `AI 调用失败（HTTP ${status}）`, '稍后重试；持续失败请检查配置');
}

export interface AiErrorInfo {
  code: AiErrorCode;
  message: string;
  hint: string;
}

/** 把任意 unknown 错误归一为用户可读的 { message, hint }（不暴露技术细节）。 */
export function describeAiError(error: unknown): AiErrorInfo {
  if (error instanceof AiError)
    return { code: error.code, message: error.message, hint: error.hint };
  if (error instanceof Error && error.name === 'AbortError')
    return {
      code: 'timeout',
      message: '请求超时',
      hint: '连接未在限定时间内完成，通常是网络不通或端点无响应。请检查网络/代理，或改用可访问的端点',
    };
  if (error instanceof TypeError)
    return {
      code: 'cors-or-network',
      message: '网络请求失败',
      hint: '浏览器无法连上该端点。请检查：①你的网络能否访问该地址；②国内网络可能需要代理；③若用自定义端点，确认它支持浏览器跨域（CORS）',
    };
  if (error instanceof Error && error.message)
    return { code: 'unknown', message: error.message, hint: '稍后重试；持续失败请检查配置' };
  return { code: 'unknown', message: 'AI 调用失败', hint: '稍后重试；持续失败请检查配置' };
}

// ---- URL ----

/** base_url → chat/completions 完整地址：去尾斜杠后拼接（容忍用户填 /v1）。 */
export function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/chat/completions`;
}
