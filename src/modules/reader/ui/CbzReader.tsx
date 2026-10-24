import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book } from '../../books';
import { markFinished, readBookBinary, reportProgress } from '../../books';
import { useSwipe } from '../../../shared/hooks/useSwipe';
import { extractCbzImages } from '../cbz';
import type JSZip from 'jszip';

interface CbzReaderProps {
  book: Book;
  onBack: () => void;
}

const SAVE_DEBOUNCE_MS = 400;

/**
 * CBZ 阅读器（漫画 / 图片集）。
 * JSZip 解包后按自然顺序逐页渲染：仅生成当前页 blobURL（导航即 revoke 旧页，不持全部图片）；
 * 进度按「图片序号 / 总页数」计算。漫画无文本，书摘 / TTS / 全文搜索天然不可用（由各自模块降级）。
 */
export function CbzReader({ book, onBack }: CbzReaderProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const zipRef = useRef<JSZip | null>(null);
  const indexRef = useRef(0);
  const finishedRef = useRef(false);
  const saveTimerRef = useRef<number>(0);
  const blobUrlRef = useRef<string | null>(null);
  const bookStatusRef = useRef(book.status);
  bookStatusRef.current = book.status;

  const [pages, setPages] = useState<string[]>([]);
  const pagesRef = useRef<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);

  const total = pages.length;
  const percentage = total > 0 ? (current + 1) / total : 0;

  // 生成当前页 blobURL（懒：仅当前页，旧页立即 revoke）。
  // pages 通过参数或 pagesRef 读取，避免首次渲染时 state 尚未更新（total=0）导致直接 return。
  const renderPage = useCallback(
    async (index: number, pagesArg?: string[]) => {
      const zip = zipRef.current;
      const pages = pagesArg ?? pagesRef.current;
      if (!zip || pages.length === 0 || index < 0 || index >= pages.length) return;
      const total = pages.length;
      setRendering(true);
      try {
        const file = zip.file(pages[index]);
        if (!file) return;
        const blob = await file.async('blob');
        const url = URL.createObjectURL(blob);
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;
        setBlobUrl(url);
        indexRef.current = index;
        setCurrent(index);

        const pct = (index + 1) / total;
        const isLast = index === total - 1;
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
          // 先保存进度再判读完，顺序执行避免两个 store 补丁竞态互相覆盖
          void (async () => {
            await reportProgress(book, index, 0, pct);
            if (isLast && !finishedRef.current && bookStatusRef.current !== 'finished') {
              finishedRef.current = true;
              markFinished(book);
            }
          })();
        }, SAVE_DEBOUNCE_MS);
      } catch (error) {
        console.error('CBZ 渲染失败', error);
        setLoadError(error instanceof Error ? error.message : 'CBZ 渲染失败');
      } finally {
        setRendering(false);
        setLoading(false);
      }
    },
    [book]
  );

  // ---- 载入 CBZ（仅一次） ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await readBookBinary(book.id);
        if (cancelled) return;
        const JSZipMod = await import('jszip');
        const zip = await JSZipMod.default.loadAsync(data);
        if (cancelled) {
          return;
        }
        zipRef.current = zip;
        const imgs = extractCbzImages(zip);
        if (cancelled) return;
        if (imgs.length === 0) {
          setLoadError('这本 CBZ 里没有可显示的图片');
          setLoading(false);
          return;
        }
        pagesRef.current = imgs;
        setPages(imgs);
        const start = Math.min(Math.max(book.chapterIndex, 0), imgs.length - 1);
        await renderPage(start, imgs);
      } catch (error) {
        if (!cancelled) {
          console.error('CBZ 打开失败', error);
          setLoadError(error instanceof Error ? error.message : 'CBZ 打开失败');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(saveTimerRef.current);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      zipRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅按书籍初始化一次
  }, [book.id]);

  const goPage = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
    if (clamped === indexRef.current && total > 0) return;
    void renderPage(clamped);
  };

  // 横向 / 竖向滑动翻页：左滑、上滑 = 下一页；右滑、下滑 = 上一页
  const { bind: bindSwipe, consumeSwipe } = useSwipe({
    onSwipe: (direction) => {
      if (direction === 'left' || direction === 'up') goPage(current + 1);
      else goPage(current - 1);
    },
  });

  useEffect(() => bindSwipe(stageRef.current), [bindSwipe]);

  const topBar = (
    <div className="reader-bar reader-bar-top" hidden={!chromeVisible}>
      <button type="button" className="icon-btn" onClick={onBack}>
        ‹ 返回
      </button>
      <span className="reader-bar-title">{book.title}</span>
      <span className="reader-bar-progress">
        {Math.round(percentage * 100)}%
        <button type="button" className="icon-btn cbz-zoom" onClick={() => setScale((s) => Math.min(s * 1.25, 4))}>
          ＋
        </button>
        <button type="button" className="icon-btn cbz-zoom" onClick={() => setScale((s) => Math.max(s / 1.25, 0.5))}>
          －
        </button>
      </span>
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
        className="cbz-stage"
        ref={stageRef}
        onClick={() => {
          if (consumeSwipe()) return;
          setChromeVisible((v) => !v);
        }}
      >
        {blobUrl && (
          <img
            className={rendering ? 'cbz-img rendering' : 'cbz-img'}
            src={blobUrl}
            alt={`第 ${current + 1} 页`}
            style={{ transform: `scale(${scale})` }}
          />
        )}
        {loading && <div className="reader-loading">载入中…</div>}
      </div>

      <div className="reader-bar reader-bar-bottom" hidden={!chromeVisible}>
        <button
          type="button"
          className="icon-btn"
          disabled={current <= 0}
          onClick={() => goPage(current - 1)}
        >
          ‹ 上一页
        </button>
        <span className="reader-bar-progress">
          {total > 0 ? `第 ${current + 1}/${total} 页` : '载入中…'}
        </span>
        <button
          type="button"
          className="icon-btn"
          disabled={current >= total - 1}
          onClick={() => goPage(current + 1)}
        >
          下一页 ›
        </button>
      </div>
    </div>
  );
}
