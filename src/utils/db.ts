import { APP_CONFIG } from '../data/missions';
import {
  AllowanceAdjustment,
  DailyAllowanceRecord,
  MultiMemberAllowanceStore,
} from '../types/allowance';
import {
  buildRecordCompositeId,
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

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      const tx = request.transaction;

      // v1 -> v2: dailyRecords の主キーを dateKey から複合キー id (`${memberId}::${dateKey}`) へ移行
      if (oldVersion === 1 && tx && db.objectStoreNames.contains(STORE_DAILY_RECORDS)) {
        const oldRecStore = tx.objectStore(STORE_DAILY_RECORDS);
        const oldAdjStore = db.objectStoreNames.contains(STORE_ADJUSTMENTS)
          ? tx.objectStore(STORE_ADJUSTMENTS)
          : null;

        const recReq = oldRecStore.getAll();
        const adjReq = oldAdjStore ? oldAdjStore.getAll() : null;

        recReq.onsuccess = () => {
          const legacyRecs = (recReq.result as DailyAllowanceRecord[]) ?? [];
          db.deleteObjectStore(STORE_DAILY_RECORDS);
          const newRecStore = db.createObjectStore(STORE_DAILY_RECORDS, { keyPath: 'id' });
          newRecStore.createIndex('byMemberId', 'memberId', { unique: false });
          for (const rec of legacyRecs) {
            const memberId = rec.memberId || APP_CONFIG.defaultMemberId;
            newRecStore.put({
              ...rec,
              memberId,
              id: buildRecordCompositeId(memberId, rec.dateKey),
            });
          }
        };

        if (adjReq && oldAdjStore) {
          adjReq.onsuccess = () => {
            const legacyAdjs = (adjReq.result as AllowanceAdjustment[]) ?? [];
            if (!oldAdjStore.indexNames.contains('byMemberId')) {
              oldAdjStore.createIndex('byMemberId', 'memberId', { unique: false });
            }
            for (const adj of legacyAdjs) {
              if (!adj.memberId) {
                oldAdjStore.put({ ...adj, memberId: APP_CONFIG.defaultMemberId });
              }
            }
          };
        }
        return;
      }

      if (!db.objectStoreNames.contains(STORE_DAILY_RECORDS)) {
        const recStore = db.createObjectStore(STORE_DAILY_RECORDS, { keyPath: 'id' });
        recStore.createIndex('byMemberId', 'memberId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_ADJUSTMENTS)) {
        const adjStore = db.createObjectStore(STORE_ADJUSTMENTS, { keyPath: 'id' });
        adjStore.createIndex('byMemberId', 'memberId', { unique: false });
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
 * 既存の localStorage 登録データを IndexedDB へ安全に移行し、全対象者の登録データを読み込む
 */
export async function initializeAndLoadDatabase(): Promise<{
  recordsByMember: MultiMemberAllowanceStore;
  adjustments: AllowanceAdjustment[];
}> {
  if (!isIndexedDBAvailable()) {
    return {
      recordsByMember: loadLegacyStore(),
      adjustments: loadLegacyAdjustments(),
    };
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();

    const migratedAlready =
      window.localStorage.getItem(APP_CONFIG.idbMigratedKey) === '1';

    if (!migratedAlready) {
      const legacyStore = loadLegacyStore();
      const legacyAdjustments = loadLegacyAdjustments();
      const legacyRecordsFlat = Object.values(legacyStore).flatMap((mStore) =>
        Object.values(mStore)
      );

      if (legacyRecordsFlat.length > 0 || legacyAdjustments.length > 0) {
        const existingRecords = await getAllFromStore<DailyAllowanceRecord>(
          db,
          STORE_DAILY_RECORDS
        );
        const existingAdjustments = await getAllFromStore<AllowanceAdjustment>(
          db,
          STORE_ADJUSTMENTS
        );
        const existingRecordIds = new Set(existingRecords.map((r) => r.id));
        const existingAdjustmentIds = new Set(existingAdjustments.map((a) => a.id));

        await new Promise<void>((resolve, reject) => {
          const tx = db!.transaction(
            [STORE_DAILY_RECORDS, STORE_ADJUSTMENTS],
            'readwrite'
          );
          const recStore = tx.objectStore(STORE_DAILY_RECORDS);
          const adjStore = tx.objectStore(STORE_ADJUSTMENTS);

          for (const rec of legacyRecordsFlat) {
            const memberId = rec.memberId || APP_CONFIG.defaultMemberId;
            const id = rec.id || buildRecordCompositeId(memberId, rec.dateKey);
            if (!existingRecordIds.has(id)) {
              recStore.put({ ...rec, memberId, id });
            }
          }
          for (const adj of legacyAdjustments) {
            if (!existingAdjustmentIds.has(adj.id)) {
              adjStore.put({
                ...adj,
                memberId: adj.memberId || APP_CONFIG.defaultMemberId,
              });
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

    const recordsByMember: MultiMemberAllowanceStore = {};
    for (const rec of dailyList) {
      const memberId = rec.memberId || APP_CONFIG.defaultMemberId;
      if (!recordsByMember[memberId]) {
        recordsByMember[memberId] = {};
      }
      recordsByMember[memberId][rec.dateKey] = {
        ...rec,
        memberId,
        id: rec.id || buildRecordCompositeId(memberId, rec.dateKey),
      };
    }

    const normalizedAdjustments = adjustmentList
      .map((adj) => ({
        ...adj,
        memberId: adj.memberId || APP_CONFIG.defaultMemberId,
      }))
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? 1 : -1;
        return a.createdAt < b.createdAt ? 1 : -1;
      });

    return { recordsByMember, adjustments: normalizedAdjustments };
  } catch {
    return {
      recordsByMember: loadLegacyStore(),
      adjustments: loadLegacyAdjustments(),
    };
  } finally {
    db?.close();
  }
}

export async function upsertDailyRecordInDb(
  record: DailyAllowanceRecord | null,
  memberId: string,
  dateKey: string,
  fallbackStore?: MultiMemberAllowanceStore
): Promise<void> {
  if (!isIndexedDBAvailable()) {
    if (fallbackStore) saveLegacyStore(fallbackStore);
    return;
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    const compositeId = buildRecordCompositeId(memberId, dateKey);
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_DAILY_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_DAILY_RECORDS);
      if (record) {
        store.put({
          ...record,
          memberId,
          id: compositeId,
        });
      } else {
        store.delete(compositeId);
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
  deleteCompositeIds: string[],
  fallbackStore?: MultiMemberAllowanceStore
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
        store.put({
          ...rec,
          id: rec.id || buildRecordCompositeId(rec.memberId, rec.dateKey),
        });
      }
      for (const compositeId of deleteCompositeIds) {
        store.delete(compositeId);
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

export async function deleteMemberDataInDb(
  memberId: string,
  fallbackStore?: MultiMemberAllowanceStore,
  fallbackAdjustments?: AllowanceAdjustment[]
): Promise<void> {
  if (!isIndexedDBAvailable()) {
    if (fallbackStore) saveLegacyStore(fallbackStore);
    if (fallbackAdjustments) saveLegacyAdjustments(fallbackAdjustments);
    return;
  }

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    const [allRecords, allAdjustments] = await Promise.all([
      getAllFromStore<DailyAllowanceRecord>(db, STORE_DAILY_RECORDS),
      getAllFromStore<AllowanceAdjustment>(db, STORE_ADJUSTMENTS),
    ]);

    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(
        [STORE_DAILY_RECORDS, STORE_ADJUSTMENTS],
        'readwrite'
      );
      const recStore = tx.objectStore(STORE_DAILY_RECORDS);
      const adjStore = tx.objectStore(STORE_ADJUSTMENTS);

      for (const rec of allRecords) {
        if (rec.memberId === memberId && rec.id) {
          recStore.delete(rec.id);
        }
      }
      for (const adj of allAdjustments) {
        if (adj.memberId === memberId) {
          adjStore.delete(adj.id);
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    if (fallbackStore) saveLegacyStore(fallbackStore);
    if (fallbackAdjustments) saveLegacyAdjustments(fallbackAdjustments);
  } finally {
    db?.close();
  }
}
