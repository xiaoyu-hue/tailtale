/**
 * epubjs 最小类型声明（社区无 @types/epubjs）。
 * 仅覆盖书时用到的 API 子集，未覆盖部分在组件内按 any 使用并注释。
 */

declare module 'epubjs' {
  export interface NavItem {
    id: string;
    href: string;
    /** 运行时通常为 string；部分实现可能是含 text 的对象 */
    label: string | { text?: string };
    subitems?: NavItem[];
  }

  export interface EpubLocation {
    start: {
      cfi: string;
      index: number;
      percentage: number;
      displayed: { page: number; total: number };
    };
    end: {
      cfi: string;
      index: number;
      percentage: number;
    };
  }

  export interface Rendition {
    display(target?: string): void;
    next(): void;
    prev(): void;
    themes: {
      fontSize(size: string): void;
      font(font: string): void;
      /** 覆盖正文样式：写入 body 内联样式（priority=true 加 !important）。无 selector 参数。 */
      override(name: string, value: string, priority?: boolean): void;
    };
    on(event: 'relocated', cb: (location: EpubLocation) => void): void;
    on(event: 'rendered', cb: (section: unknown, view: unknown) => void): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
    currentLocation(): EpubLocation | null;
    destroy(): void;
  }

  export interface EpubSection {
    href: string;
    /** 加载章节内容（epubjs Section.load，参数为 Book 实例） */
    load(book: EpubBook): Promise<unknown>;
    /** 卸载章节，释放 document */
    unload(): void;
    /** load 之后可访问的章节文档（M5 AI 解读提取全文用） */
    document?: Document;
  }

  export interface EpubBook {
    ready: Promise<void>;
    navigation: { toc: NavItem[] };
    spine: { length: number; spine: EpubSection[] };
    renderTo(element: HTMLElement, options?: Record<string, unknown>): Rendition;
    destroy(): void;
  }

  interface EpubFactory {
    (data: ArrayBuffer | string, options?: Record<string, unknown>): EpubBook;
  }

  const ePub: EpubFactory;
  export default ePub;
}
