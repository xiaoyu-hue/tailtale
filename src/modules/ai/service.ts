import { readBookBinary, readBookContent } from '../books';
import type { Book } from '../books';
import {
  AI_SYSTEM_PROMPT,
  AiError,
  GROUP_RULES,
  OUTPUT_TOKEN_ESTIMATE,
  PROMPT_OVERHEAD_TOKENS,
  aiErrorFromStatus,
  buildAskPrompt,
  buildChunkSummaryPrompt,
  buildOutlinePrompt,
  chatCompletionsUrl,
  describeAiError,
  estimateExplainCost,
  estimateTokens,
  groupText,
  isAiConfigured,
  type AiConfig,
  type AiErrorInfo,
  type CostEstimate,
} from './model';

/**
 * ai 模块服务层：持久化、网络请求、EPUB 提取等一切副作用。
 * 铁律：网络 fetch 只准出现在本文件（架构设计 §5）；密钥只随请求发往
 * 用户自行配置的端点，禁止任何上传/转发/遥测逻辑，禁止打印密钥。
 */

// ---- 配置持久化（localStorage，仿 settings 模块） ----

const AI_CONFIG_KEY = 'tailtale:ai';

/** 读取 AI 配置（同步）：localStorage 是设备本地偏好，不进 IndexedDB。 */
export function loadAiConfig(): AiConfig {
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_KEY);
    if (!raw) return { baseUrl: '', apiKey: '', model: '' };
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
    };
  } catch (error) {
    console.error('读取 AI 配置失败，使用空配置', error);
    return { baseUrl: '', apiKey: '', model: '' };
  }
}

export function saveAiConfig(config: AiConfig): void {
  try {
    window.localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('保存 AI 配置失败', error);
  }
}

// ---- DeepSeek / OpenAI 兼容调用 ----

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/** 单次调用超时：浏览器直连第三方端点，25 秒足够判断连通性，避免用户干等。 */
const AI_TIMEOUT_MS = 25_000;

/** EPUB 全文提取超时：纯本地解析，超时即视为该书结构异常，避免永久卡死。 */
const EPUB_EXTRACT_TIMEOUT_MS = 25_000;

/** 让一个 Promise 在 ms 毫秒后按 onTimeout 指定的错误被拒绝（不阻止原 Promise 继续执行其收尾）。 */
function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => AiError): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

// ---- 串行队列：AI 调用全部排队执行，避免重复扣费与并发风暴 ----

let tail: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const queued = tail.then(task);
  tail = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AiError('aborted', '已取消', '你取消了本次解读');
}

/**
 * 调用一次 chat/completions（OpenAI 兼容协议）。
 * 串行执行；60 秒超时与外部取消信号联动；非 2xx 映射为用户可读错误。
 */
export async function callChat(
  config: AiConfig,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  return serialize(async (): Promise<string> => {
    throwIfAborted(signal);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, AI_TIMEOUT_MS);
    const onExternalAbort = (): void => controller.abort();
    signal?.addEventListener('abort', onExternalAbort);
    try {
      const response = await fetch(chatCompletionsUrl(config.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: config.model.trim(),
          messages,
          temperature: 0.3,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw aiErrorFromStatus(response.status);
      let data: ChatCompletionResponse;
      try {
        data = (await response.json()) as ChatCompletionResponse;
      } catch {
        throw new AiError('server-error', '模型返回了无法解析的内容', '稍后重试；持续失败请更换模型');
      }
      const content = data.choices?.[0]?.message?.content;
      if (!content || !content.trim())
        throw new AiError('empty-response', '模型返回了空内容', '重试一次；频繁出现请更换模型');
      return content.trim();
    } catch (err) {
      // 超时机制触发的 abort：明确为「连接超时」，而非用户取消
      if (timedOut) {
        throw new AiError(
          'timeout',
          '连接超时',
          '你的网络在限定时间内连不上该端点。请检查网络或代理，或改用其他可访问的 OpenAI 兼容端点'
        );
      }
      // 用户主动取消（外部 signal 触发 abort）
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AiError('aborted', '已取消', '你取消了本次解读');
      }
      // 其余（含网络层 TypeError: Failed to fetch）原样抛出，交由 describeAiError 归一
      throw err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  });
}

// ---- EPUB 全文提取 ----

/** 块级元素选择器：按块拼接，保留段落换行（textContent 会丢失块边界）。 */
const EPUB_BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th';

/** 取最外层块级元素的文本，按行拼接（嵌套块去重，如 li 内的 p）。 */
function blockText(root: HTMLElement): string {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(EPUB_BLOCK_SELECTOR)).filter(
    (el) => el.closest(EPUB_BLOCK_SELECTOR) === el
  );
  const source = blocks.length > 0 ? blocks : [root];
  return source
    .map((el) => (el.textContent ?? '').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

interface EpubExtractResult {
  text: string;
  /** 解析失败的章节数（降级：跳过并在结果中明示） */
  failedSections: number;
}

/**
 * 从 EPUB 二进制提取全书文本：经 epubjs 逐节 load/unload（大书懒加载，防内存峰值），
 * 结束后 destroy。整体失败抛 AiError('epub-extract-failed') 引导用户转 TXT。
 */
async function extractEpubText(data: ArrayBuffer): Promise<EpubExtractResult> {
  const { default: ePub } = await import('epubjs');
  const instance = ePub(data, { allowScriptedContent: false, allowPopups: false });
  const parts: string[] = [];
  let failedSections = 0;
  try {
    await instance.ready;
    const sections = instance.spine.spine;
    for (const section of sections) {
      try {
        await section.load(instance);
        const text = section.document?.body ? blockText(section.document.body) : '';
        if (text.trim()) parts.push(text);
      } catch {
        failedSections += 1;
      } finally {
        try {
          section.unload();
        } catch {
          // 释放失败不影响主流程
        }
      }
    }
  } finally {
    instance.destroy();
  }
  if (parts.length === 0)
    throw new AiError('epub-extract-failed', 'EPUB 解析失败', '这本书无法提取文字，可先转换为 TXT 再解读');
  return { text: parts.join('\n\n'), failedSections };
}

// ---- 解读流程 ----

export interface PrepareResult {
  /** 全书文本（TXT 原文 / EPUB 提取文本） */
  text: string;
  estimate: CostEstimate;
  /** 需要向用户明示的降级信息（截断 / EPUB 部分章节失败） */
  warning?: string;
}

/** 解读前准备：取全文 + 估算费用（UI 据此弹费用预估窗，确认后才真正调用）。 */
export async function prepareExplain(book: Book): Promise<PrepareResult> {
  const warnings: string[] = [];
  let text: string;
  if (book.format === 'txt') {
    text = await readBookContent(book.id);
  } else if (book.format === 'epub') {
    const { text: extracted, failedSections } = await withTimeout(
      extractEpubText(await readBookBinary(book.id)),
      EPUB_EXTRACT_TIMEOUT_MS,
      () =>
        new AiError(
          'epub-extract-failed',
          'EPUB 解析超时',
          '这本书解析耗时过长，可能是结构异常。可先转换为 TXT 再解读'
        )
    );
    text = extracted;
    if (failedSections > 0)
      warnings.push(`有 ${failedSections} 个章节解析失败，大纲可能不完整`);
  } else {
    throw new AiError('book-missing', '暂不支持该格式', 'AI 解读目前仅支持 TXT 与 EPUB');
  }
  if (!text.trim())
    throw new AiError('book-missing', '这本书没有可解读的文字', '请换一本书，或检查文件是否正常');
  const estimate = estimateExplainCost(text);
  if (estimate.truncated)
    warnings.push(
      `全书约 ${estimate.totalChars} 字，超出单次处理上限，将基于前约 ${
        GROUP_RULES.MAX_GROUPS * GROUP_RULES.TARGET_CHARS
      } 字生成`
    );
  return { text, estimate, warning: warnings.length > 0 ? warnings.join('；') : undefined };
}

export interface ExplainHooks {
  /** 进度回调：已完成分组数 / 总分组数（单遍直读时不触发） */
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface ExplainResult {
  bookId: string;
  title: string;
  outline: string;
  calls: number;
  inputTokens: number;
  truncated: boolean;
  warning?: string;
}

/** 生成全书大纲：≤2.4 万字单遍直读；否则 map-reduce（串行分组摘要 → 合并大纲）。 */
export async function runExplain(
  config: AiConfig,
  book: Book,
  text: string,
  hooks: ExplainHooks = {}
): Promise<ExplainResult> {
  const truncatedWarning = (truncated: boolean): string | undefined =>
    truncated
      ? `因全书过长，大纲基于前约 ${GROUP_RULES.MAX_GROUPS * GROUP_RULES.TARGET_CHARS} 字生成`
      : undefined;

  if (text.length <= GROUP_RULES.SINGLE_PASS_CHARS) {
    const outline = await callChat(
      config,
      [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: buildOutlinePrompt(book.title, [text], text.length) },
      ],
      hooks.signal
    );
    return {
      bookId: book.id,
      title: book.title,
      outline,
      calls: 1,
      inputTokens: estimateTokens(text) + PROMPT_OVERHEAD_TOKENS,
      truncated: false,
    };
  }

  const { groups, truncated } = groupText(text);
  const parts: string[] = [];
  for (let i = 0; i < groups.length; i += 1) {
    throwIfAborted(hooks.signal);
    const summary = await callChat(
      config,
      [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildChunkSummaryPrompt(book.title, groups[i], groups.length),
        },
      ],
      hooks.signal
    );
    parts.push(summary);
    hooks.onProgress?.(i + 1, groups.length);
  }

  const outline = await callChat(
    config,
    [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: buildOutlinePrompt(book.title, parts, text.length) },
    ],
    hooks.signal
  );
  return {
    bookId: book.id,
    title: book.title,
    outline,
    calls: groups.length + 1,
    inputTokens: estimateExplainCost(text).inputTokens,
    truncated,
    warning: truncatedWarning(truncated),
  };
}

/** 针对已生成大纲的书籍提问（单次调用，上下文 = 大纲）。 */
export async function askAboutBook(
  config: AiConfig,
  bookTitle: string,
  outline: string,
  question: string,
  signal?: AbortSignal
): Promise<string> {
  return callChat(
    config,
    [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: buildAskPrompt(bookTitle, outline, question) },
    ],
    signal
  );
}

/** 输出 token 参考预估值（提问用，供 UI 展示）。 */
export const ASK_OUTPUT_TOKENS = OUTPUT_TOKEN_ESTIMATE.answer;

/**
 * 连通性探测：用一次极小的对话请求验证「端点可达 + 密钥有效」。
 * 设置页「测试连接」按钮调用，让用户在正式解读前就能发现网络/配置问题，
 * 不必等到读完书点生成才知道失败（符合人类操作的提前反馈）。
 */
export async function testConnection(
  config: AiConfig
): Promise<{ ok: boolean; error?: AiErrorInfo }> {
  if (!isAiConfigured(config))
    return {
      ok: false,
      error: {
        code: 'not-configured',
        message: '请先填好三个字段',
        hint: '接口地址、模型、API 密钥都需要填写完整',
      },
    };
  try {
    const reply = await callChat(config, [
      { role: 'system', content: '你是连接测试助手，只回复一个字：OK' },
      { role: 'user', content: '请回复 OK' },
    ]);
    return { ok: reply.trim().length > 0 };
  } catch (e) {
    return { ok: false, error: describeAiError(e) };
  }
}
