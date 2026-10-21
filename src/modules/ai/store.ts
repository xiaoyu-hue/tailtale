import { createStore, useStore } from '../../platform/store';
import type { Book } from '../books';
import {
  askAboutBook,
  loadAiConfig,
  prepareExplain,
  runExplain,
  saveAiConfig,
  type ExplainHooks,
} from './service';
import {
  AiError,
  defaultAiConfig,
  isAiConfigured,
  type AiConfig,
} from './model';

/**
 * ai 模块状态层：配置（useSyncExternalStore 单例）+ 大纲会话缓存。
 * 大纲缓存只存内存、不落库：刷新页面即失效，避免为同一本书重复付费；
 * 提问必须基于已生成大纲（PRD §5.3：提问针对书中内容，上下文可控）。
 */

export interface AiState {
  config: AiConfig;
}

const store = createStore<AiState>({ config: loadAiConfig() });

// ---- 订阅 hooks ----

export function useAiConfig(): AiConfig {
  return useStore(store, (s) => s.config);
}

export function useAiConfigured(): boolean {
  return useStore(store, (s) => isAiConfigured(s.config));
}

// ---- 配置动作（每次变更立即持久化，仿 settings.patch） ----

export function patchAiConfig(patch: Partial<AiConfig>): void {
  const config = { ...store.getState().config, ...patch };
  store.setState({ config });
  saveAiConfig(config);
}

export function resetAiConfig(): void {
  const config = defaultAiConfig();
  store.setState({ config });
  saveAiConfig(config);
}

// ---- 大纲会话缓存 ----

export interface CachedOutline {
  bookId: string;
  title: string;
  outline: string;
  calls: number;
  inputTokens: number;
  truncated: boolean;
  createdAt: number;
}

const outlineCache = new Map<string, CachedOutline>();

export function getCachedOutline(bookId: string): CachedOutline | undefined {
  return outlineCache.get(bookId);
}

function requireConfig(): AiConfig {
  const config = store.getState().config;
  if (!isAiConfigured(config))
    throw new AiError('not-configured', '尚未配置 AI 密钥', '请到「我的」页的 AI 设置填写密钥后再来');
  return config;
}

/**
 * 生成大纲并写入会话缓存。text 由 UI 经 prepareExplain 取得（费用预估确认后传入）。
 */
export async function runOutline(
  book: Book,
  text: string,
  hooks: ExplainHooks = {}
): Promise<CachedOutline> {
  const config = requireConfig();
  const result = await runExplain(config, book, text, hooks);
  const cached: CachedOutline = {
    bookId: result.bookId,
    title: result.title,
    outline: result.outline,
    calls: result.calls,
    inputTokens: result.inputTokens,
    truncated: result.truncated,
    createdAt: Date.now(),
  };
  outlineCache.set(book.id, cached);
  return cached;
}

/** 基于会话缓存的大纲提问；未生成过大纲则抛 no-outline 引导用户先大纲。 */
export async function ask(
  bookId: string,
  question: string,
  signal?: AbortSignal
): Promise<string> {
  const config = requireConfig();
  const cached = outlineCache.get(bookId);
  if (!cached)
    throw new AiError(
      'no-outline',
      '尚未生成本书大纲',
      '请先在「大纲」标签生成大纲，提问会基于大纲回答'
    );
  return askAboutBook(config, cached.title, cached.outline, question, signal);
}

/** 解读前准备（费用预估数据源），UI 弹窗确认后才调 runOutline。 */
export { prepareExplain };
