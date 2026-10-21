const DB_NAME = 'tailtale';
const DB_VERSION = 3;

/**
 * 存储 schema：store 名集中登记在平台层。
 * 新增 store 时在 MIGRATIONS 中登记一条迁移，版本号只增不改。
 */
export const STORE_BOOKS = 'books';
export const STORE_CONTENTS = 'contents';
export const STORE_WALLET = 'wallet';
export const STORE_CHECKINS = 'checkins';
export const STORE_READING_SESSION = 'reading_session';
export const STORE_PET = 'pet';

interface Migration {
  version: number;
  upgrade: (db: IDBDatabase) => void;
}

function createStoreIfMissing(db: IDBDatabase, name: string): void {
  if (!db.objectStoreNames.contains(name)) {
    db.createObjectStore(name, { keyPath: 'id' });
  }
}

/** 版本迁移按序登记：upgrade 在 onupgradeneeded 中按 version > oldVersion 执行。 */
const MIGRATIONS: Migration[] = [
  {
    // v2：游戏化（M2/S3）——金币钱包、打卡记录、阅读会话
    version: 2,
    upgrade: (db) => {
      createStoreIfMissing(db, STORE_WALLET);
      createStoreIfMissing(db, STORE_CHECKINS);
      createStoreIfMissing(db, STORE_READING_SESSION);
    },
  },
  {
    // v3：宠物系统（M3/S1）——宠物单例行（三属性/好感度/成长/睡觉态）
    version: 3,
    upgrade: (db) => {
      createStoreIfMissing(db, STORE_PET);
    },
  },
];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        // v1 基础 store（幂等）
        createStoreIfMissing(db, STORE_BOOKS);
        createStoreIfMissing(db, STORE_CONTENTS);
        // 后续版本迁移按序执行（event.oldVersion 为升级前的版本号）
        const oldVersion = event.oldVersion;
        for (const migration of MIGRATIONS) {
          if (migration.version > oldVersion) migration.upgrade(db);
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
 * 业务封装（Book / Wallet 等）放在各自模块的 service 层。
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
