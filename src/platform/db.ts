import type { Book, BookContent } from '../types';

const DB_NAME = 'tailtale';
const DB_VERSION = 1;
const STORE_BOOKS = 'books';
const STORE_CONTENTS = 'contents';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_BOOKS)) {
          db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CONTENTS)) {
          db.createObjectStore(STORE_CONTENTS, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (objectStore: IDBObjectStore) => IDBRequest
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = action(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      })
  );
}

export async function putBook(book: Book): Promise<void> {
  await run(STORE_BOOKS, 'readwrite', (s) => s.put(book));
}

export async function getBook(id: string): Promise<Book | undefined> {
  return run<Book | undefined>(STORE_BOOKS, 'readonly', (s) => s.get(id));
}

export async function getAllBooks(): Promise<Book[]> {
  return run<Book[]>(STORE_BOOKS, 'readonly', (s) => s.getAll());
}

export async function deleteBook(id: string): Promise<void> {
  await run(STORE_BOOKS, 'readwrite', (s) => s.delete(id));
}

export async function putContent(content: BookContent): Promise<void> {
  await run(STORE_CONTENTS, 'readwrite', (s) => s.put(content));
}

export async function getContent(id: string): Promise<BookContent | undefined> {
  return run<BookContent | undefined>(STORE_CONTENTS, 'readonly', (s) => s.get(id));
}

export async function deleteContent(id: string): Promise<void> {
  await run(STORE_CONTENTS, 'readwrite', (s) => s.delete(id));
}
