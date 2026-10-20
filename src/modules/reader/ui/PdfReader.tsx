import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book } from '../../books';
import { markFinished, readBookBinary, reportProgress } from '../../books';
import { useSwipe } from '../../../shared/hooks/useSwipe';

interface PdfReaderProps {
  book: Book;
  onBack: () => void;
}

const SAVE_DEBOUNCE_MS = 400;

/**
 * PDF 阅读器（pdf.js）。
 * canvas 按页渲染 + 懒加载（只渲染当前页，大文件不卡）；
 * 进度按「页码 / 总页数」计算，与 TXT / EPUB 分支并列。
 * 引擎与 worker 按需动态加载，其他格式用户不受包体影响。
 */
export function PdfReader({ book, onBack }: PdfReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const pageRef = useRef(1);
  const finishedRef = useRef(false);
  const saveTimerRef = useRef<number>(0);
  const bookStatusRef = useRef(book.status);
  bookStatusRef.current = book.status;

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [rendering, setRendering] = useState(false);

  const percentage = numPages > 0 ? currentPage / numPages : 0;

  // ---- 渲染指定页（懒加载：仅当前页） ----
  const renderPage = useCallback(
    async (pageNumber: number) => {
      const doc = docRef.current;
      const canvas = canvasRef.current;
      if (!doc || !canvas) return;
      setRendering(true);
      try {
        const page = await doc.getPage(pageNumber);
        const container = canvas.parentElement;
        if (!container) return;
        // 适配容器尺寸的缩放（contain 模式），dpr 保证清晰度
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(container.clientWidth / base.width, container.clientHeight / base.height);
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pageRef.current = pageNumber;
        setCurrentPage(pageNumber);

        const pct = pageNumber / doc.numPages;
        const isLastPage = pageNumber === doc.numPages;
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
          // 先保存进度再判读完：顺序执行，避免两个 store 补丁竞态互相覆盖
          void (async () => {
            await reportProgress(book, pageNumber - 1, 0, pct);
            if (
              isLastPage &&
              !finishedRef.current &&
              bookStatusRef.current !== 'finished'
            ) {
              finishedRef.current = true;
              markFinished(book);
            }
          })();
        }, SAVE_DEBOUNCE_MS);
      } catch (error) {
        console.error('PDF 渲染失败', error);
        setLoadError(error instanceof Error ? error.message : 'PDF 渲染失败');
      } finally {
        setRendering(false);
      }
    },
    [book]
  );

  // ---- 载入 PDF（仅一次） ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await readBookBinary(book.id);
        if (cancelled) return;
        // 按需加载引擎与 worker：仅在打开 PDF 时才下载 pdfjs 包体
        const [pdfjs, workerUrlMod] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrlMod.default;
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);
        // 恢复上次页码（Book.chapterIndex 对 PDF 语义为页码 - 1）
        const startPage = Math.min(Math.max(book.chapterIndex + 1, 1), doc.numPages);
        await renderPage(startPage);
      } catch (error) {
        if (!cancelled) {
          console.error('PDF 打开失败', error);
          setLoadError(error instanceof Error ? error.message : 'PDF 打开失败');
        }
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(saveTimerRef.current);
      docRef.current?.destroy();
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅按书籍初始化一次
  }, [book.id]);

  // ---- 窗口尺寸变化时重渲当前页（保持适配） ----
  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (docRef.current && canvasRef.current) void renderPage(pageRef.current);
      }, 200);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [renderPage]);

  const goPage = (pageNumber: number) => {
    const clamped = Math.min(Math.max(pageNumber, 1), Math.max(numPages, 1));
    if (clamped === pageRef.current && numPages > 0) return;
    void renderPage(clamped);
  };

  // 横向 / 竖向滑动翻页：左滑、上滑 = 下一页；右滑、下滑 = 上一页
  const { handlers: swipeHandlers, consumeSwipe } = useSwipe({
    onSwipe: (direction) => {
      if (direction === 'left' || direction === 'up') goPage(currentPage + 1);
      else goPage(currentPage - 1);
    },
  });

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

      <div
        className="pdf-stage"
        {...swipeHandlers}
        onClick={() => {
          // 滑动尾随的 click 要吞掉，否则翻页同时会误切控件栏显隐
          if (consumeSwipe()) return;
          setChromeVisible((v) => !v);
        }}
      >
        <canvas ref={canvasRef} className={rendering ? 'pdf-canvas rendering' : 'pdf-canvas'} />
        {rendering && <div className="pdf-rendering">渲染中…</div>}
      </div>

      <div className="reader-bar reader-bar-bottom" hidden={!chromeVisible}>
        <button
          type="button"
          className="icon-btn"
          disabled={currentPage <= 1}
          onClick={() => goPage(currentPage - 1)}
        >
          ‹ 上一页
        </button>
        <span className="reader-bar-progress">
          {numPages > 0 ? `第 ${currentPage}/${numPages} 页` : '载入中…'}
        </span>
        <button
          type="button"
          className="icon-btn"
          disabled={currentPage >= numPages}
          onClick={() => goPage(currentPage + 1)}
        >
          下一页 ›
        </button>
      </div>
    </div>
  );
}
