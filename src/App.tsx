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
  MissionDefinition,
  MissionEntryState,
  RegistrationFeedback,
} from './types/allowance';
import {
  calculateBalanceSummary,
  loadAdjustments,
  loadAllowanceStore,
  loadMissions,
  saveAdjustments,
  saveAllowanceStore,
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
  const [records, setRecords] = useState<AllowanceStore>(() => loadAllowanceStore());
  const [missions, setMissions] = useState<MissionDefinition[]>(() => loadMissions());
  const [adjustments, setAdjustments] = useState<AllowanceAdjustment[]>(() =>
    loadAdjustments()
  );
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

      if (!hasAnyCompleted && totalAmount === 0) {
        delete nextRecords[dateKey];
      } else {
        nextRecords[dateKey] = {
          dateKey,
          items,
          totalAmount,
          updatedAt: new Date().toISOString(),
        };
      }

      setRecords(nextRecords);
      saveAllowanceStore(nextRecords);

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
      let totalDelta = 0;

      for (const dateKey of dateKeys) {
        const prevDayAmount = records[dateKey]?.totalAmount ?? 0;
        const newDayAmount = !hasAnyCompleted && dailyTotalAmount === 0 ? 0 : dailyTotalAmount;
        const dayDelta = newDayAmount - prevDayAmount;
        dateDeltas[dateKey] = dayDelta;
        totalDelta += dayDelta;

        if (!hasAnyCompleted && dailyTotalAmount === 0) {
          delete nextRecords[dateKey];
        } else {
          nextRecords[dateKey] = {
            dateKey,
            items: Object.fromEntries(
              Object.entries(items).map(([k, v]) => [k, { ...v }])
            ),
            totalAmount: dailyTotalAmount,
            updatedAt: nowIso,
          };
        }
      }

      setRecords(nextRecords);
      saveAllowanceStore(nextRecords);

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

  // --- ミッション項目 CRUD ---
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

  // --- 任意金額調整 ---
  const handleAddAdjustment = useCallback(
    (input: Omit<AllowanceAdjustment, 'id' | 'createdAt'>) => {
      setAdjustments((prev) => {
        const next: AllowanceAdjustment[] = [
          {
            ...input,
            id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
        saveAdjustments(next);
        return next;
      });
    },
    []
  );

  const handleDeleteAdjustment = useCallback((adjustmentId: string) => {
    setAdjustments((prev) => {
      const next = prev.filter((a) => a.id !== adjustmentId);
      saveAdjustments(next);
      return next;
    });
  }, []);

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
