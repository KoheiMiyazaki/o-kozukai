import { APP_CONFIG } from '../data/missions';
import {
  AllowanceAdjustment,
  AllowanceStore,
  DailyAllowanceRecord,
} from '../types/allowance';
import {
  loadAdjustments as loadLegacyAdjustments,
  loadAllowanceStore as loadLegacyStore,
  saveAdjustments as saveLegacyAdjustments,
  saveAllowanceStore as saveLegacyStore,
} from './storage';

const STORE_DAILY_RECORDS = 'dailyRecords';
const STORE_ADJUSTMENTS = 'adjustments';

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = window.indexedDB.open(APP_CONFIG.dbName, APP_CONFIG.dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DAILY_RECORDS)) {
        db.createObjectStore(STORE_DAILY_RECORDS, { keyPath: 'dateKey' });
      }
      if (!db.objectStoreNames.contains(STORE_ADJUSTMENTS)) {
        db.createObjectStore(STORE_ADJUSTMENTS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error(`Failed to read ${storeName}`));
  });
}

/**
 * 既存の localStorage 登録データを IndexedDB へ安全に移行し、全登録データを読み込む
 */
export async function initializeAndLoadDatabase(): Promise<{
  records: AllowanceStore;
  adjustments: AllowanceAdjustment[];
}> {
  if (!isIndexedDBAvailable()) {
    return {
      records: loadLegacyStore(),
      adjustments: loadLegacyAdjustments(),
    };
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();

    const migratedAlready =
      window.localStorage.getItem(APP_CONFIG.idbMigratedKey) === '1';

    if (!migratedAlready) {
      const legacyRecords = loadLegacyStore();
      const legacyAdjustments = loadLegacyAdjustments();
      const hasLegacyData =
        Object.keys(legacyRecords).length > 0 || legacyAdjustments.length > 0;

      if (hasLegacyData) {
        const existingRecords = await getAllFromStore<DailyAllowanceRecord>(
          db,
          STORE_DAILY_RECORDS
        );
        const existingAdjustments = await getAllFromStore<AllowanceAdjustment>(
          db,
          STORE_ADJUSTMENTS
        );
        const existingRecordKeys = new Set(existingRecords.map((r) => r.dateKey));
        const existingAdjustmentIds = new Set(existingAdjustments.map((a) => a.id));

        await new Promise<void>((resolve, reject) => {
          const tx = db!.transaction(
            [STORE_DAILY_RECORDS, STORE_ADJUSTMENTS],
            'readwrite'
          );
          const recStore = tx.objectStore(STORE_DAILY_RECORDS);
          const adjStore = tx.objectStore(STORE_ADJUSTMENTS);

          for (const rec of Object.values(legacyRecords)) {
            if (!existingRecordKeys.has(rec.dateKey)) {
              recStore.put(rec);
            }
          }
          for (const adj of legacyAdjustments) {
            if (!existingAdjustmentIds.has(adj.id)) {
              adjStore.put(adj);
            }
          }

          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }

      window.localStorage.setItem(APP_CONFIG.idbMigratedKey, '1');
      window.localStorage.removeItem(APP_CONFIG.storageKey);
      window.localStorage.removeItem(APP_CONFIG.adjustmentsStorageKey);
    }

    const [dailyList, adjustmentList] = await Promise.all([
      getAllFromStore<DailyAllowanceRecord>(db, STORE_DAILY_RECORDS),
      getAllFromStore<AllowanceAdjustment>(db, STORE_ADJUSTMENTS),
    ]);

    const records: AllowanceStore = {};
    for (const rec of dailyList) {
      records[rec.dateKey] = rec;
    }

    adjustmentList.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

    return { records, adjustments: adjustmentList };
  } catch {
    return {
      records: loadLegacyStore(),
      adjustments: loadLegacyAdjustments(),
    };
  } finally {
    db?.close();
  }
}

export async function upsertDailyRecordInDb(
  record: DailyAllowanceRecord | null,
  dateKey: string,
  fallbackStore?: AllowanceStore
): Promise<void> {
  if (!isIndexedDBAvailable()) {
    if (fallbackStore) saveLegacyStore(fallbackStore);
    return;
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_DAILY_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_DAILY_RECORDS);
      if (record) {
        store.put(record);
      } else {
        store.delete(dateKey);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    if (fallbackStore) saveLegacyStore(fallbackStore);
  } finally {
    db?.close();
  }
}

export async function upsertBulkRecordsInDb(
  upserts: DailyAllowanceRecord[],
  deletes: string[],
  fallbackStore?: AllowanceStore
): Promise<void> {
  if (!isIndexedDBAvailable()) {
    if (fallbackStore) saveLegacyStore(fallbackStore);
    return;
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_DAILY_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_DAILY_RECORDS);
      for (const rec of upserts) {
        store.put(rec);
      }
      for (const dateKey of deletes) {
        store.delete(dateKey);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    if (fallbackStore) saveLegacyStore(fallbackStore);
  } finally {
    db?.close();
  }
}

export async function addAdjustmentInDb(
  adjustment: AllowanceAdjustment,
  fallbackList?: AllowanceAdjustment[]
): Promise<void> {
  if (!isIndexedDBAvailable()) {
    if (fallbackList) saveLegacyAdjustments(fallbackList);
    return;
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_ADJUSTMENTS, 'readwrite');
      tx.objectStore(STORE_ADJUSTMENTS).put(adjustment);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    if (fallbackList) saveLegacyAdjustments(fallbackList);
  } finally {
    db?.close();
  }
}

export async function deleteAdjustmentInDb(
  adjustmentId: string,
  fallbackList?: AllowanceAdjustment[]
): Promise<void> {
  if (!isIndexedDBAvailable()) {
    if (fallbackList) saveLegacyAdjustments(fallbackList);
    return;
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_ADJUSTMENTS, 'readwrite');
      tx.objectStore(STORE_ADJUSTMENTS).delete(adjustmentId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    if (fallbackList) saveLegacyAdjustments(fallbackList);
  } finally {
    db?.close();
  }
}
