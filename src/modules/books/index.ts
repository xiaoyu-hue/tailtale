// books 模块公开 API：其他模块与应用层只准经此文件依赖 books
export {
  useBooks,
  useBooksLoaded,
  useRecentBook,
  refreshBooks,
  importFiles,
  deleteBookById,
  claimBuiltin,
  changeStatus,
  reportProgress,
  markFinished,
} from './store';
export { readBookContent, readBookBinary } from './service';
export type { ImportResult } from './store';
export type { Book, BookStatus, BookContent, BookFormat } from './model';
export { STATUS_LABEL, nextStatus, FORMAT_LABEL } from './model';
export { ImportZone } from './ui/ImportZone';
export { ContinueReading } from './ui/ContinueReading';
export { BookList } from './ui/BookList';
export { LibrarySection } from './ui/LibrarySection';
export { fetchLibraryManifest, claimBuiltinBook, LIBRARY_BASE_URL } from './library';
export type { LibraryBook, LibraryManifest } from './library-model';
