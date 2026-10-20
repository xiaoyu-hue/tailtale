import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '../../books';
import { markFinished, readBookContent, reportProgress } from '../../books';
import { startReading, stopReading } from '../../gamification';
import { MAX_FONT_SIZE_INDEX, fontSizeAt, setFontSizeIndex, useFontSizeIndex } from '../../settings';
import { splitChapters } from '../model';

interface ReaderPageProps {
  book: Book;
  onBack: () => void;
}

const SAVE_DEBOUNCE_MS = 400;
const FINISH_THRESHOLD = 0.98;

/** 正文独立 memo：滚动刷新进度时避免重排长段落列表 */
const ChapterBody = memo(function ChapterBody({
  lines,
  fontSize,
}: {
  lines: string[];
  fontSize: number;
}) {
  return (
    <div className="reader-inner" style={{ fontSize: `${fontSize}px` }}>
      <div className="reader-text">
        {lines.map((line, index) => (
          <p className="reader-line" key={index}>
            {line || '\u00A0'}
          </p>
        ))}
      </div>
    </div>
  );
});

export function ReaderPage({ book, onBack }: ReaderPageProps) {
  const [text, setText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [scrollRatio, setScrollRatio] = useState(book.scrollRatio);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 正文字号为全局偏好（settings 模块），跨书籍记忆、在我的页亦可调
  const fontSizeIndex = useFontSizeIndex();
  const fontSize = fontSizeAt(fontSizeIndex);

  const stageRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number>(0);
  const restoredRef = useRef(false);
  const finishedRef = useRef(false);
  const targetRatioRef = useRef<number | null>(null);

  const chapters = useMemo(() => (text ? splitChapters(text) : []), [text]);
  const chapter = chapters[chapterIndex];

  // 加载全文（M2 起 EPUB 改为按需加载）
  useEffect(() => {
    let cancelled = false;
    readBookContent(book.id)
      .then((loaded) => {
        if (!cancelled) setText(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : '加载失败');
      });
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  // 阅读计时：打开书籍即开始，离开阅读页（组件卸载）即停。
  // 全屏沉浸页没有 Tab 栏，离开的唯一操作是返回书架，语义上等于"合上书"（见架构文档 S3）。
  useEffect(() => {
    void startReading(book.id).catch((error: unknown) => {
      console.error('启动阅读计时失败', error);
    });
    return () => stopReading();
  }, [book.id]);

  // 首次加载：恢复上次阅读的章节与章内位置
  useEffect(() => {
    if (restoredRef.current || chapters.length === 0) return;
    restoredRef.current = true;
    const index = Math.min(Math.max(book.chapterIndex, 0), chapters.length - 1);
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
  }, [chapters.length, book.chapterIndex, book.scrollRatio]);

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
    const overall = chapters.length > 0 ? (index + ratio) / chapters.length : 0;
    void reportProgress(book, index, ratio, overall);
  };

  const handleScroll = () => {
    const element = stageRef.current;
    if (!element || chapters.length === 0) return;
    const max = element.scrollHeight - element.clientHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, element.scrollTop / max)) : 1;
    setScrollRatio(ratio);

    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persist(chapterIndex, ratio);
      const isLast = chapterIndex === chapters.length - 1;
      if (isLast && ratio >= FINISH_THRESHOLD && !finishedRef.current && book.status !== 'finished') {
        finishedRef.current = true;
        void markFinished(book);
      }
    }, SAVE_DEBOUNCE_MS);
  };

  const goChapter = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), chapters.length - 1);
    setChapterIndex(clamped);
    setScrollRatio(0);
    targetRatioRef.current = 0;
    setDrawerOpen(false);
    persist(clamped, 0);
  };

  const chapterBody = useMemo(() => {
    if (!text || !chapter) return [];
    return text.slice(chapter.start, chapter.end).split('\n').slice(1);
  }, [text, chapter]);

  const overallProgress =
    chapters.length > 0 ? (chapterIndex + scrollRatio) / chapters.length : 0;

  const topBar = (
    <div className="reader-bar reader-bar-top" hidden={!chromeVisible}>
      <button type="button" className="icon-btn" onClick={onBack}>
        ‹ 返回
      </button>
      <span className="reader-bar-title">{book.title}</span>
      <span className="reader-bar-progress">
        {chapterIndex + 1}/{chapters.length}
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

  if (!chapter) {
    return (
      <div className="reader">
        {topBar}
        <div className="reader-loading">正在打开《{book.title}》…</div>
      </div>
    );
  }

  return (
    <div className="reader">
      {topBar}

      <div
        className="reader-stage"
        ref={stageRef}
        onScroll={handleScroll}
        onClick={() => setChromeVisible((visible) => !visible)}
      >
        <h2 className="reader-chapter-title">{chapter.title}</h2>
        <ChapterBody lines={chapterBody} fontSize={fontSize} />
      </div>

      <div className="reader-bar reader-bar-bottom" hidden={!chromeVisible}>
        <button
          type="button"
          className="icon-btn"
          disabled={chapterIndex === 0}
          onClick={() => goChapter(chapterIndex - 1)}
        >
          ‹ 上一章
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
        <button
          type="button"
          className="icon-btn"
          disabled={chapterIndex === chapters.length - 1}
          onClick={() => goChapter(chapterIndex + 1)}
        >
          下一章 ›
        </button>
      </div>

      {drawerOpen && (
        <>
          <div className="reader-drawer-mask" onClick={() => setDrawerOpen(false)} />
          <aside className="reader-drawer">
            <div className="reader-drawer-title">目录（{chapters.length} 章）</div>
            {chapters.map((item, index) => (
              <button
                key={`${item.title}-${item.start}`}
                type="button"
                className={`chapter-item${index === chapterIndex ? ' current' : ''}`}
                onClick={() => goChapter(index)}
              >
                {index + 1}. {item.title}
              </button>
            ))}
          </aside>
        </>
      )}
    </div>
  );
}
