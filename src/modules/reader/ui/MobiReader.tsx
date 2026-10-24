import { useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '../../books';
import { markFinished, openMobiBook, readBookBinary, reportProgress } from '../../books';
import type { MobiBookContent, MobiTocEntry } from '../../books';
import {
  MAX_FONT_SIZE_INDEX,
  fontSizeAt,
  lineHeightAt,
  marginAt,
  setFontSizeIndex,
  useFontSizeIndex,
  useLineHeightIndex,
  useMarginIndex,
} from '../../settings';
import { AiDrawer } from '../../ai';
import { useSwipe } from '../../../shared/hooks/useSwipe';
import { ErrorState } from '../../../components';

interface MobiReaderProps {
  book: Book;
  onBack: () => void;
}

const SAVE_DEBOUNCE_MS = 400;
const FINISH_THRESHOLD = 0.98;

/**
 * MOBI / AZW3 阅读器（批次2，vendored foliate-js mobi.js）。
 * 打开时一次性解析全部章节为「净化后的 HTML + 纯文本」（openMobiBook），
 * 章节滚动阅读复用 TXT 的交互骨架与全局字号 / 行距 / 页边距设置。
 * 与 TXT 一致不支持划词书摘（书摘收集目前仅 EPUB 接入）；
 * TTS / 全文搜索 / AI 解读经 extractText 的 mobi 分支自动获得文本。
 */
export function MobiReader({ book, onBack }: MobiReaderProps) {
  const [content, setContent] = useState<MobiBookContent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 重试计数器：错误态「重新加载」时 +1，重新触发载入 effect
  const [reloadKey, setReloadKey] = useState(0);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [scrollRatio, setScrollRatio] = useState(book.scrollRatio);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  // 正文字号 / 行距 / 页边距为全局偏好（settings 模块），跨书籍记忆、在我的页亦可调
  const fontSizeIndex = useFontSizeIndex();
  const fontSize = fontSizeAt(fontSizeIndex);
  const lineHeightIndex = useLineHeightIndex();
  const marginIndex = useMarginIndex();
  const lineHeight = lineHeightAt(lineHeightIndex);
  const margin = marginAt(marginIndex);

  const stageRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number>(0);
  const restoredRef = useRef(false);
  const finishedRef = useRef(false);
  const targetRatioRef = useRef<number | null>(null);

  const sectionCount = content?.sections.length ?? 0;

  // ---- 载入 MOBI（书籍切换或重试时重新解析） ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadError(null);
        const data = await readBookBinary(book.id);
        if (cancelled) return;
        const opened = await openMobiBook(data);
        if (cancelled) return;
        setContent(opened);
      } catch (error) {
        if (cancelled) return;
        console.error('MOBI 打开失败', error);
        setLoadError(
          '这本 MOBI / AZW3 无法解析。若它是从 Kindle 商店购买的，可能带有 DRM 保护——书时不解密受保护内容，请使用无 DRM 版本；也可能是文件已损坏。'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book.id, reloadKey]);

  // 目录：优先用书籍自带目录（可定位的条目）；无可用目录时退化为按节列出
  const tocEntries = useMemo<MobiTocEntry[]>(() => {
    if (!content) return [];
    const usable = content.toc.filter(
      (t) => t.index >= 0 && t.index < content.sections.length
    );
    if (usable.length > 0) return usable;
    return content.sections.map((_, i) => ({ label: `第 ${i + 1} 节`, index: i, level: 0 }));
  }, [content]);

  const chapterTitle = useMemo(() => {
    const entry = tocEntries.find((t) => t.index === chapterIndex);
    return entry?.label ?? `第 ${chapterIndex + 1} 节`;
  }, [tocEntries, chapterIndex]);

  // 首次载入完成：恢复上次阅读的章节与章内位置
  useEffect(() => {
    if (restoredRef.current || sectionCount === 0) return;
    restoredRef.current = true;
    const index = Math.min(Math.max(book.chapterIndex, 0), sectionCount - 1);
    if (index !== 0) {
      targetRatioRef.current = book.scrollRatio;
      setChapterIndex(index);
    } else if (book.scrollRatio > 0) {
      requestAnimationFrame(() => {
        const element = stageRef.current;
        if (element) {
          element.scrollTop = book.scrollRatio * (element.scrollHeight - element.clientHeight);
        }
      });
    }
  }, [sectionCount, book.chapterIndex, book.scrollRatio]);

  // 章节切换后按比例恢复滚动位置
  useEffect(() => {
    const element = stageRef.current;
    if (!element || targetRatioRef.current === null) return;
    const ratio = targetRatioRef.current;
    targetRatioRef.current = null;
    element.scrollTop = ratio * (element.scrollHeight - element.clientHeight);
  }, [chapterIndex]);

  useEffect(
    () => () => {
      window.clearTimeout(saveTimerRef.current);
    },
    []
  );

  const persist = (index: number, ratio: number) => {
    const overall = sectionCount > 0 ? (index + ratio) / sectionCount : 0;
    void reportProgress(book, index, ratio, overall);
  };

  const handleScroll = () => {
    const element = stageRef.current;
    if (!element || sectionCount === 0) return;
    const max = element.scrollHeight - element.clientHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, element.scrollTop / max)) : 1;
    setScrollRatio(ratio);

    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persist(chapterIndex, ratio);
      const isLast = chapterIndex === sectionCount - 1;
      if (isLast && ratio >= FINISH_THRESHOLD && !finishedRef.current && book.status !== 'finished') {
        finishedRef.current = true;
        void markFinished(book);
      }
    }, SAVE_DEBOUNCE_MS);
  };

  const goChapter = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), sectionCount - 1);
    setChapterIndex(clamped);
    setScrollRatio(0);
    targetRatioRef.current = 0;
    setDrawerOpen(false);
    persist(clamped, 0);
  };

  // 横向滑动切章（左滑下一章 / 右滑上一章）；竖向交还原生滚动，axis 只认横向
  const { bind: bindSwipe, consumeSwipe } = useSwipe({
    axis: 'horizontal',
    onSwipe: (direction) => {
      if (direction === 'left') goChapter(chapterIndex + 1);
      else goChapter(chapterIndex - 1);
    },
  });

  // 原生绑定舞台元素（passive: false）：iOS Safari 下必须阻止系统滚动才能收到 touchend，
  // React 合成事件的 touchmove 是 passive 的，拦不住滚动——这是 iOS 真机滑动失效的根因。
  // deps 带 chapterIndex：书籍内容异步加载，章节就绪前舞台未渲染，加载后需重新绑定。
  useEffect(() => bindSwipe(stageRef.current), [bindSwipe, chapterIndex]);

  const overallProgress =
    sectionCount > 0 ? (chapterIndex + scrollRatio) / sectionCount : 0;

  const topBar = (
    <div className="reader-bar reader-bar-top" hidden={!chromeVisible}>
      <button type="button" className="icon-btn" onClick={onBack}>
        ‹ 返回
      </button>
      <span className="reader-bar-title">{book.title}</span>
      <span className="reader-bar-progress">
        {chapterIndex + 1}/{sectionCount || '…'}
      </span>
    </div>
  );

  if (loadError) {
    return (
      <div className="reader">
        {topBar}
        <div className="reader-loading">
          <ErrorState
            title="书籍加载失败"
            message={loadError}
            retryLabel="重新加载"
            onRetry={() => {
              setLoadError(null);
              setReloadKey((k) => k + 1);
            }}
          />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="reader">
        {topBar}
        <div className="reader-loading">正在解析《{book.title}》…</div>
      </div>
    );
  }

  const section = content.sections[chapterIndex];

  return (
    <div className="reader">
      {topBar}

      <div
        className="reader-stage"
        ref={stageRef}
        onScroll={handleScroll}
        onClick={() => {
          // 滑动尾随的 click 要吞掉，否则翻页同时会误切控件栏显隐
          if (consumeSwipe()) return;
          setChromeVisible((visible) => !visible);
        }}
      >
        <h2 className="reader-chapter-title">{chapterTitle}</h2>
        <div className="reader-inner" style={{ fontSize: `${fontSize}px`, padding: `${margin}px` }}>
          {/* 内容已经 openMobiBook 净化（去脚本/危险属性/kindle 图片），可安全注入 */}
          <div className="reader-text mobi-body" style={{ lineHeight }} dangerouslySetInnerHTML={{ __html: section?.html ?? '' }} />
        </div>
      </div>

      <div className="reader-bar reader-bar-bottom" hidden={!chromeVisible}>
        <button
          type="button"
          className="icon-btn"
          disabled={chapterIndex === 0}
          onClick={() => goChapter(chapterIndex - 1)}
        >
          ‹ 上一节
        </button>
        <span className="reader-bar-progress">总进度 {Math.round(overallProgress * 100)}%</span>
        <div className="reader-fontsize">
          <button
            type="button"
            className="icon-btn"
            disabled={fontSizeIndex === 0}
            onClick={() => setFontSizeIndex(fontSizeIndex - 1)}
            aria-label="减小字号"
          >
            A−
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={fontSizeIndex === MAX_FONT_SIZE_INDEX}
            onClick={() => setFontSizeIndex(fontSizeIndex + 1)}
            aria-label="增大字号"
          >
            A＋
          </button>
        </div>
        <button type="button" className="icon-btn" onClick={() => setDrawerOpen(true)}>
          目录
        </button>
        <button type="button" className="icon-btn" onClick={() => setAiOpen(true)} aria-label="AI 解读">
          AI
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={chapterIndex === sectionCount - 1}
          onClick={() => goChapter(chapterIndex + 1)}
        >
          下一节 ›
        </button>
      </div>

      {drawerOpen && (
        <>
          <div className="reader-drawer-mask" onClick={() => setDrawerOpen(false)} />
          <aside className="reader-drawer">
            <div className="reader-drawer-title">目录（{tocEntries.length} 项）</div>
            {tocEntries.map((item, i) => (
              <button
                key={`${item.label}-${item.index}-${i}`}
                type="button"
                className={`chapter-item${item.index === chapterIndex ? ' current' : ''}`}
                style={{ paddingLeft: `${12 + item.level * 16}px` }}
                onClick={() => goChapter(item.index)}
              >
                {item.label}
              </button>
            ))}
          </aside>
        </>
      )}

      {aiOpen && <AiDrawer book={book} onClose={() => setAiOpen(false)} />}
    </div>
  );
}
