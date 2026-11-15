/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalyticsView } from './components/AnalyticsView';
import { BulkRegisterView } from './components/BulkRegisterView';
import { CalendarView } from './components/CalendarView';
import { LedgerView } from './components/LedgerView';
import { OfflineBanner } from './components/OfflineBanner';
import { RegisterView } from './components/RegisterView';
import { SettingsView } from './components/SettingsView';
import { APP_CONFIG } from './data/missions';
import {
  AllowanceAdjustment,
  AllowanceStore,
  AppScreen,
  DailyAllowanceRecord,
  MissionDefinition,
  MissionEntryState,
  RegistrationFeedback,
} from './types/allowance';
import {
  addAdjustmentInDb,
  deleteAdjustmentInDb,
  initializeAndLoadDatabase,
  upsertBulkRecordsInDb,
  upsertDailyRecordInDb,
} from './utils/db';
import {
  calculateBalanceSummary,
  loadMissions,
  saveMissions,
} from './utils/storage';

type ThemeMode = 'dark' | 'light';

function getInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(APP_CONFIG.themeStorageKey);
    if (saved === 'light') return 'light';
  } catch {
    // fallback to dark default
  }
  return 'dark';
}

export default function App() {
  // 登録履歴・金額調整データは IndexedDB で管理
  const [records, setRecords] = useState<AllowanceStore>({});
  const [adjustments, setAdjustments] = useState<AllowanceAdjustment[]>([]);
  const [isDbReady, setIsDbReady] = useState(false);

  // 項目設定・テーマ設定は軽量なため localStorage で同期管理
  const [missions, setMissions] = useState<MissionDefinition[]>(() => loadMissions());
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  const [screen, setScreen] = useState<AppScreen>('calendar');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [registerReturnScreen, setRegisterReturnScreen] = useState<'calendar' | 'ledger'>('calendar');
  const [registrationFeedback, setRegistrationFeedback] = useState<RegistrationFeedback | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    let cancelled = false;
    initializeAndLoadDatabase().then((data) => {
      if (cancelled) return;
      setRecords(data.records);
      setAdjustments(data.adjustments);
      setIsDbReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    try {
      window.localStorage.setItem(APP_CONFIG.themeStorageKey, theme);
    } catch {
      // ignore storage failure
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0c0a09' : '#059669');
    }
  }, [theme]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const triggerFeedback = useCallback((feedback: RegistrationFeedback) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    setRegistrationFeedback(feedback);
    feedbackTimerRef.current = window.setTimeout(() => {
      setRegistrationFeedback(null);
      feedbackTimerRef.current = null;
    }, 2600);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleChangeMonth = useCallback((year: number, month: number) => {
    setViewMonth({ year, month });
  }, []);

  const handleSelectDateFromCalendar = useCallback((dateKey: string) => {
    setSelectedDateKey(dateKey);
    setRegisterReturnScreen('calendar');
    setScreen('register');
  }, []);

  const handleSelectDateFromLedger = useCallback((dateKey: string) => {
    setSelectedDateKey(dateKey);
    setRegisterReturnScreen('ledger');
    setScreen('register');
  }, []);

  const handleBackFromRegister = useCallback(() => {
    setSelectedDateKey(null);
    setScreen(registerReturnScreen);
  }, [registerReturnScreen]);

  const handleSaveDay = useCallback(
    (dateKey: string, items: Record<string, MissionEntryState>, totalAmount: number) => {
      const prevDayAmount = records[dateKey]?.totalAmount ?? 0;
      const previousBalance = calculateBalanceSummary(records, adjustments).currentBalance;
      const delta = totalAmount - prevDayAmount;
      const nextBalance = previousBalance + delta;

      const nextRecords: AllowanceStore = { ...records };
      const hasAnyCompleted = Object.values(items).some((item) => item.completed);
      let savedRecord: DailyAllowanceRecord | null = null;

      if (!hasAnyCompleted && totalAmount === 0) {
        delete nextRecords[dateKey];
      } else {
        savedRecord = {
          dateKey,
          items,
          totalAmount,
          updatedAt: new Date().toISOString(),
        };
        nextRecords[dateKey] = savedRecord;
      }

      setRecords(nextRecords);
      void upsertDailyRecordInDb(savedRecord, dateKey, nextRecords);

      triggerFeedback({
        id: Date.now(),
        delta,
        previousBalance,
        nextBalance,
        affectedDateKeys: [dateKey],
        dateDeltas: { [dateKey]: delta },
      });

      // 登録内容を保存後、自動的にカレンダー画面へ戻る
      setSelectedDateKey(null);
      setScreen('calendar');
    },
    [records, adjustments, triggerFeedback]
  );

  const handleSaveBulk = useCallback(
    (
      dateKeys: string[],
      items: Record<string, MissionEntryState>,
      dailyTotalAmount: number
    ) => {
      const previousBalance = calculateBalanceSummary(records, adjustments).currentBalance;
      const nextRecords: AllowanceStore = { ...records };
      const hasAnyCompleted = Object.values(items).some((item) => item.completed);
      const nowIso = new Date().toISOString();
      const dateDeltas: Record<string, number> = {};
      const upserts: DailyAllowanceRecord[] = [];
      const deletes: string[] = [];
      let totalDelta = 0;

      for (const dateKey of dateKeys) {
        const prevDayAmount = records[dateKey]?.totalAmount ?? 0;
        const newDayAmount = !hasAnyCompleted && dailyTotalAmount === 0 ? 0 : dailyTotalAmount;
        const dayDelta = newDayAmount - prevDayAmount;
        dateDeltas[dateKey] = dayDelta;
        totalDelta += dayDelta;

        if (!hasAnyCompleted && dailyTotalAmount === 0) {
          delete nextRecords[dateKey];
          deletes.push(dateKey);
        } else {
          const rec: DailyAllowanceRecord = {
            dateKey,
            items: Object.fromEntries(
              Object.entries(items).map(([k, v]) => [k, { ...v }])
            ),
            totalAmount: dailyTotalAmount,
            updatedAt: nowIso,
          };
          nextRecords[dateKey] = rec;
          upserts.push(rec);
        }
      }

      setRecords(nextRecords);
      void upsertBulkRecordsInDb(upserts, deletes, nextRecords);

      triggerFeedback({
        id: Date.now(),
        delta: totalDelta,
        previousBalance,
        nextBalance: previousBalance + totalDelta,
        affectedDateKeys: dateKeys,
        dateDeltas,
      });

      setScreen('calendar');
    },
    [records, adjustments, triggerFeedback]
  );

  // --- ミッション項目 CRUD（localStorage管理） ---
  const handleAddMission = useCallback(
    (input: Omit<MissionDefinition, 'id' | 'imagePath'>) => {
      setMissions((prev) => {
        const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const next: MissionDefinition[] = [
          ...prev,
          {
            ...input,
            id,
            /* TODO: 画像差し替え用パス */
            imagePath: '',
          },
        ];
        saveMissions(next);
        return next;
      });
    },
    []
  );

  const handleUpdateMission = useCallback((updated: MissionDefinition) => {
    setMissions((prev) => {
      const next = prev.map((m) => (m.id === updated.id ? updated : m));
      saveMissions(next);
      return next;
    });
  }, []);

  const handleDeleteMission = useCallback((missionId: string) => {
    setMissions((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((m) => m.id !== missionId);
      saveMissions(next);
      return next;
    });
  }, []);

  // --- 任意金額調整（IndexedDB管理） ---
  const handleAddAdjustment = useCallback(
    (input: Omit<AllowanceAdjustment, 'id' | 'createdAt'>) => {
      const newAdjustment: AllowanceAdjustment = {
        ...input,
        id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setAdjustments((prev) => {
        const next = [newAdjustment, ...prev];
        void addAdjustmentInDb(newAdjustment, next);
        return next;
      });
    },
    []
  );

  const handleDeleteAdjustment = useCallback((adjustmentId: string) => {
    setAdjustments((prev) => {
      const next = prev.filter((a) => a.id !== adjustmentId);
      void deleteAdjustmentInDb(adjustmentId, next);
      return next;
    });
  }, []);

  if (!isDbReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#FAF9F6] text-stone-500 dark:bg-stone-950 dark:text-stone-400">
        <p className="text-sm font-medium">データを読み込み中...</p>
      </div>
    );
  }

  return (
    <>
      <OfflineBanner />
      {screen === 'register' && selectedDateKey ? (
        <RegisterView
          key={selectedDateKey}
          dateKey={selectedDateKey}
          missions={missions}
          existingRecord={records[selectedDateKey]}
          onBack={handleBackFromRegister}
          onSave={handleSaveDay}
        />
      ) : screen === 'bulk-register' ? (
        <BulkRegisterView
          missions={missions}
          records={records}
          onBack={() => setScreen('calendar')}
          onSaveBulk={handleSaveBulk}
        />
      ) : screen === 'ledger' ? (
        <LedgerView
          records={records}
          adjustments={adjustments}
          missions={missions}
          onSelectDate={handleSelectDateFromLedger}
          onOpenAnalytics={() => setScreen('analytics')}
          onOpenSettings={() => setScreen('settings')}
          onBack={() => setScreen('calendar')}
        />
      ) : screen === 'analytics' ? (
        <AnalyticsView
          records={records}
          missions={missions}
          onBack={() => setScreen('ledger')}
        />
      ) : screen === 'settings' ? (
        <SettingsView
          missions={missions}
          records={records}
          adjustments={adjustments}
          onAddMission={handleAddMission}
          onUpdateMission={handleUpdateMission}
          onDeleteMission={handleDeleteMission}
          onAddAdjustment={handleAddAdjustment}
          onDeleteAdjustment={handleDeleteAdjustment}
          onBack={() => setScreen('ledger')}
        />
      ) : (
        <CalendarView
          currentYear={viewMonth.year}
          currentMonth={viewMonth.month}
          records={records}
          adjustments={adjustments}
          feedback={registrationFeedback}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onChangeMonth={handleChangeMonth}
          onSelectDate={handleSelectDateFromCalendar}
          onOpenBulkRegister={() => setScreen('bulk-register')}
          onOpenLedger={() => setScreen('ledger')}
        />
      )}
    </>
  );
}
