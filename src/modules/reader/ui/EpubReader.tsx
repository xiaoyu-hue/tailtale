import { useEffect, useRef, useState } from 'react';
import type { NavItem, Rendition, EpubBook } from 'epubjs';
import type { Book } from '../../books';
import { markFinished, readBookBinary, reportProgress } from '../../books';
import { MAX_FONT_SIZE_INDEX, fontSizeAt, setFontSizeIndex, useFontSizeIndex } from '../../settings';

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
  const [toc, setToc] = useState<NavItem[]>([]);
  const [percentage, setPercentage] = useState(book.progress);
  const [pageInfo, setPageInfo] = useState('');
  const [chromeVisible, setChromeVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const finishedRef = useRef(false);
  const saveTimerRef = useRef<number>(0);
  const bookStatusRef = useRef(book.status);
  bookStatusRef.current = book.status;

  // 正文字号为全局偏好（settings 模块）
  const fontSizeIndex = useFontSizeIndex();
  const fontSize = fontSizeAt(fontSizeIndex);

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
        // 有 CFI 精确恢复，否则从头开始
        rendition.display(book.cfi || undefined);

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

        // 点击正文区域切换顶/底栏显隐（iframe 内点击冒泡到 iframe 元素）
        rendition.on('rendered', (_section, view) => {
          const element = view as unknown as
            | { addEventListener?: (type: string, cb: () => void) => void }
            | undefined;
          element?.addEventListener?.('click', () => setChromeVisible((v) => !v));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅按书籍初始化一次；字号变化走独立 effect
  }, [book.id]);

  // ---- 字号变化同步到 rendition ----
  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontSize}px`);
  }, [fontSize]);

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
          <div style={{ textAlign: 'center', padding: '0 24px', lineHeight: 1.9 }}>
            书籍加载失败
            <br />
            <span style={{ fontSize: 13 }}>{loadError}</span>
          </div>
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
    </div>
  );
}
