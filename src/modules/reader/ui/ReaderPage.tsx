import { useEffect } from 'react';
import type { Book } from '../../books';
import { startReading, stopReading } from '../../gamification';
import { EpubReader } from './EpubReader';
import { PdfReader } from './PdfReader';
import { TxtReader } from './TxtReader';

interface ReaderPageProps {
  book: Book;
  onBack: () => void;
}

/**
 * 阅读器分发（1.1.0 起支持多格式）：
 * txt  → TxtReader（全文 + 章节滚动）
 * epub → EpubReader（epub.js 流式分页）
 * pdf  → PdfReader（pdf.js canvas 按页渲染）
 *
 * 阅读计时统一在此挂载：打开书籍即开始，离开阅读页（组件卸载）即停。
 * 全屏沉浸页没有 Tab 栏，离开的唯一操作是返回书架，语义上等于"合上书"（见架构文档 S3）。
 */
export function ReaderPage({ book, onBack }: ReaderPageProps) {
  useEffect(() => {
    void startReading(book.id).catch((error: unknown) => {
      console.error('启动阅读计时失败', error);
    });
    return () => stopReading();
  }, [book.id]);

  if (book.format === 'epub') return <EpubReader book={book} onBack={onBack} />;
  if (book.format === 'pdf') return <PdfReader book={book} onBack={onBack} />;
  return <TxtReader book={book} onBack={onBack} />;
}
