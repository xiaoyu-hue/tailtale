import { useEffect, useRef, useState } from 'react';
import type { NavItem, Rendition, EpubBook } from 'epubjs';
import type { Book } from '../../books';
import { markFinished, readBookBinary, reportProgress } from '../../books';
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

interface EpubReaderProps {
  book: Book;
  onBack: () => void;
}

const SAVE_DEBOUNCE_MS = 400;

/**
 * EPUB 阅读器（epub.js）。
 * 与 TXT 分支并列的格式分流实现：iframe 流式分页、目录导航、CFI 精确续读。
 * 引擎按需动态加载（import('epubjs')），TXT 用户不受包体影响。
 */
export function EpubReader({ book, onBack }: EpubReaderProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 重试计数器：错误态「重试」时 +1，重新触发载入 effect（清理旧 rendition 后重载）
  const [reloadKey, setReloadKey] = useState(0);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [percentage, setPercentage] = useState(book.progress);
  const [pageInfo, setPageInfo] = useState('');
  const [chromeVisible, setChromeVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const finishedRef = useRef(false);
  const saveTimerRef = useRef<number>(0);
  const bookStatusRef = useRef(book.status);
  bookStatusRef.current = book.status;
  // 已绑过手势的 iframe 文档（epub.js 视图复用，rendered 会重复触发，防监听器叠加双翻页）
  const swipeBoundDocsRef = useRef(new WeakSet<Document>());

  // 正文字号 / 行距 / 页边距为全局偏好（settings 模块）
  const fontSizeIndex = useFontSizeIndex();
  const fontSize = fontSizeAt(fontSizeIndex);
  const lineHeightIndex = useLineHeightIndex();
  const marginIndex = useMarginIndex();
  const lineHeight = lineHeightAt(lineHeightIndex);
  const margin = marginAt(marginIndex);

  // 横向 / 竖向滑动翻页：左滑、上滑 = 下一页；右滑、下滑 = 上一页
  const { bind: bindSwipe, consumeSwipe } = useSwipe({
    onSwipe: (direction) => {
      if (direction === 'left' || direction === 'up') renditionRef.current?.next();
      else renditionRef.current?.prev();
    },
  });

  // ---- 载入 EPUB 并创建 rendition（仅一次） ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await readBookBinary(book.id);
        if (cancelled) return;
        // 按需加载引擎：仅在打开 EPUB 时才下载 epubjs 包体
        const { default: ePub } = await import('epubjs');
        if (cancelled) return;
        const instance = ePub(data, { allowScriptedContent: false, allowPopups: false });
        bookRef.current = instance;
        await instance.ready;
        if (cancelled) {
          instance.destroy();
          return;
        }
        setToc(instance.navigation.toc);

        const stage = stageRef.current;
        if (!stage) return;
        const rendition = instance.renderTo(stage, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          manager: 'default',
          allowScriptedContent: false,
        });
        renditionRef.current = rendition;
        rendition.themes.fontSize(`${fontSize}px`);
        rendition.themes.override('line-height', String(lineHeight));
        rendition.themes.override('padding', `${margin}px`);
        // 有 CFI 精确恢复，否则从头开始。epubjs 的 display 在类型上声明返回 void，但运行时会
        // 返回 Promise；用 Promise.resolve 兜底捕获其 rejection（如跨设备/旧版备份导致的非法 CFI），
        // 失败时回首页，避免 unhandled rejection 卡死阅读页。
        const safeDisplay = (target?: string, fallback = true): void => {
          Promise.resolve(rendition.display(target) as unknown as Promise<unknown>).catch(() => {
            console.error('恢复阅读位置失败', target);
            if (fallback) safeDisplay(undefined, false);
          });
        };
        safeDisplay(book.cfi);

        rendition.on('relocated', (location) => {
          const { start } = location;
          // epub.js 的 start.percentage 在 element 级 CFI 下恒为 0（已知坑），
          // 改用「spine 序号 + 章内页码」加权估算全书进度。
          const spineLength = Math.max(1, instance.spine.length);
          const inSection = (start.displayed.page - 1) / Math.max(1, start.displayed.total);
          const pct = (start.index + inSection) / spineLength;
          const isLastPage =
            start.index >= spineLength - 1 && start.displayed.page >= start.displayed.total;
          setPercentage(pct);
          setPageInfo(`第 ${start.displayed.page}/${start.displayed.total} 页`);
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = window.setTimeout(() => {
            // 先保存进度再判读完：顺序执行，避免两个 store 补丁竞态互相覆盖
            void (async () => {
              await reportProgress(book, start.index, 0, pct, start.cfi);
              if (isLastPage && !finishedRef.current && bookStatusRef.current !== 'finished') {
                finishedRef.current = true;
                markFinished(book);
              }
            })();
          }, SAVE_DEBOUNCE_MS);
        });

        // 触摸事件发生在 iframe 文档内，不会冒泡到外层 div，
        // 必须绑到 view.document（IframeView 无 addEventListener，挂它本身是无效的）。
        rendition.on('rendered', (_section, view) => {
          const doc = (view as unknown as { document?: Document }).document;
          if (!doc || swipeBoundDocsRef.current.has(doc)) return;
          swipeBoundDocsRef.current.add(doc);

          // 禁掉 iframe 内原生平移/缩放手势（分页内容由我们的滑动接管，防止拖动时内容被平移）
          doc.documentElement.style.touchAction = 'none';

          // 原生绑定 + 非被动监听（iOS 兼容：不阻止系统滚动就收不到 touchend）；
          // 捕获阶段 + stopImmediatePropagation：禁用 epub.js 内置滑动（snap_Snap 有速度门槛
          // 且仅横向，与另两个阅读器体验不一致），避免内置 snap 与统一手势双翻页。
          bindSwipe(doc, { capture: true, stopImmediate: true });

          // 点击正文区域切换顶/底栏显隐（滑动尾随的 click 要吞掉）
          doc.addEventListener('click', () => {
            if (consumeSwipe()) return;
            setChromeVisible((v) => !v);
          });
        });
      } catch (error) {
        if (!cancelled) {
          console.error('EPUB 打开失败', error);
          setLoadError(error instanceof Error ? error.message : 'EPUB 打开失败');
        }
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(saveTimerRef.current);
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 按书籍初始化或重试触发；字号/行距/页边距变化走独立 effect
  }, [book.id, reloadKey]);

  // ---- 字号变化同步到 rendition ----
  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}px`);
  }, [fontSize]);

  // ---- 行距 / 页边距变化同步到 rendition ----
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    rendition.themes.override('line-height', String(lineHeight));
    rendition.themes.override('padding', `${margin}px`);
  }, [lineHeight, margin]);

  const goTo = (href: string) => {
    renditionRef.current?.display(href);
    setDrawerOpen(false);
  };

  const topBar = (
    <div className="reader-bar reader-bar-top" hidden={!chromeVisible}>
      <button type="button" className="icon-btn" onClick={onBack}>
        ‹ 返回
      </button>
      <span className="reader-bar-title">{book.title}</span>
      <span className="reader-bar-progress">{Math.round(percentage * 100)}%</span>
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
              // 自增计数器触发载入 effect 重新执行（清理旧 rendition 后重载），
              // 给错误态一条真正的恢复路径，而非只能退出重进。
              setReloadKey((k) => k + 1);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="reader">
      {topBar}

      <div className="epub-stage" ref={stageRef} />

      <div className="reader-bar reader-bar-bottom" hidden={!chromeVisible}>
        <button type="button" className="icon-btn" onClick={() => renditionRef.current?.prev()}>
          ‹ 上一页
        </button>
        <span className="reader-bar-progress">
          {pageInfo || `总进度 ${Math.round(percentage * 100)}%`}
        </span>
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
        <button type="button" className="icon-btn" onClick={() => renditionRef.current?.next()}>
          下一页 ›
        </button>
      </div>

      {drawerOpen && (
        <>
          <div className="reader-drawer-mask" onClick={() => setDrawerOpen(false)} />
          <aside className="reader-drawer">
            <div className="reader-drawer-title">目录（{toc.length} 项）</div>
            {toc.map((item) => (
              <button
                key={item.id || item.href}
                type="button"
                className="chapter-item"
                onClick={() => goTo(item.href)}
              >
                {typeof item.label === 'string' ? item.label : item.label?.text || item.href}
              </button>
            ))}
          </aside>
        </>
      )}

      {aiOpen && <AiDrawer book={book} onClose={() => setAiOpen(false)} />}
    </div>
  );
}
