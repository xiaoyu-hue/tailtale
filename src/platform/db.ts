const DB_NAME = 'tailtale';
const DB_VERSION = 1;

/**
 * 存储 schema：store 名集中登记在平台层。
 * S3 起新增 store（金币/宠物等）时在此扩展，并登记版本迁移。
 */
export const STORE_BOOKS = 'books';
export const STORE_CONTENTS = 'contents';

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

/**
 * 通用事务执行器。平台层不感知任何业务类型（T 由调用方给出），
 * 业务封装（Book / BookContent 等）放在各自模块的 service 层。
 */
export function run<T>(
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
