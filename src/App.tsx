/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnalyticsView } from './components/AnalyticsView';
import { BulkRegisterView } from './components/BulkRegisterView';
import { CalendarView } from './components/CalendarView';
import { LedgerView } from './components/LedgerView';
import { OfflineBanner } from './components/OfflineBanner';
import { RegisterView } from './components/RegisterView';
import { SettingsView } from './components/SettingsView';
import { APP_CONFIG, MISSIONS_DATA } from './data/missions';
import {
  AllowanceAdjustment,
  AllowanceMember,
  AllowanceStore,
  AppScreen,
  DailyAllowanceRecord,
  MissionDefinition,
  MissionEntryState,
  MultiMemberAllowanceStore,
  MultiMemberMissionsStore,
  RegistrationFeedback,
} from './types/allowance';
import {
  addAdjustmentInDb,
  deleteAdjustmentInDb,
  deleteMemberDataInDb,
  initializeAndLoadDatabase,
  upsertBulkRecordsInDb,
  upsertDailyRecordInDb,
} from './utils/db';
import {
  buildRecordCompositeId,
  calculateBalanceSummary,
  cloneDefaultMissions,
  loadActiveMemberId,
  loadMembers,
  loadMissionsByMember,
  saveActiveMemberId,
  saveMembers,
  saveMissionsByMember,
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
  // 登録履歴・金額調整データは IndexedDB で対象者ごとに管理
  const [recordsByMember, setRecordsByMember] = useState<MultiMemberAllowanceStore>({});
  const [allAdjustments, setAllAdjustments] = useState<AllowanceAdjustment[]>([]);
  const [isDbReady, setIsDbReady] = useState(false);

  // 対象者リスト・選択中対象者・対象者別項目設定・テーマ設定は軽量なため localStorage で同期管理
  const [members, setMembers] = useState<AllowanceMember[]>(() => loadMembers());
  const [activeMemberId, setActiveMemberId] = useState<string>(() =>
    loadActiveMemberId(loadMembers())
  );
  const [missionsByMember, setMissionsByMember] = useState<MultiMemberMissionsStore>(() =>
    loadMissionsByMember(loadMembers())
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

  const activeMember = useMemo(
    () => members.find((m) => m.id === activeMemberId) ?? members[0],
    [members, activeMemberId]
  );

  const activeMissions = useMemo<MissionDefinition[]>(
    () => missionsByMember[activeMember.id] ?? MISSIONS_DATA,
    [missionsByMember, activeMember.id]
  );

  const activeRecords = useMemo<AllowanceStore>(
    () => recordsByMember[activeMember.id] ?? {},
    [recordsByMember, activeMember.id]
  );

  const activeAdjustments = useMemo(
    () => allAdjustments.filter((adj) => adj.memberId === activeMember.id),
    [allAdjustments, activeMember.id]
  );

  useEffect(() => {
    let cancelled = false;
    initializeAndLoadDatabase().then((data) => {
      if (cancelled) return;
      setRecordsByMember(data.recordsByMember);
      setAllAdjustments(data.adjustments);
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

  // --- 対象者切り替え・追加・編集・削除 ---
  const handleSelectMember = useCallback((memberId: string) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setRegistrationFeedback(null);
    setActiveMemberId(memberId);
    saveActiveMemberId(memberId);
  }, []);

  const handleAddMember = useCallback((input: { name: string; emoji: string }) => {
    const newMember: AllowanceMember = {
      id: `member_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: input.name,
      emoji: input.emoji,
      createdAt: new Date().toISOString(),
    };
    setMembers((prev) => {
      const next = [...prev, newMember];
      saveMembers(next);
      return next;
    });
    setMissionsByMember((prev) => {
      const next: MultiMemberMissionsStore = {
        ...prev,
        [newMember.id]: cloneDefaultMissions(MISSIONS_DATA),
      };
      saveMissionsByMember(next);
      return next;
    });
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setRegistrationFeedback(null);
    setActiveMemberId(newMember.id);
    saveActiveMemberId(newMember.id);
  }, []);

  const handleUpdateMember = useCallback((updated: AllowanceMember) => {
    setMembers((prev) => {
      const next = prev.map((m) => (m.id === updated.id ? updated : m));
      saveMembers(next);
      return next;
    });
  }, []);

  const handleDeleteMember = useCallback(
    (memberId: string) => {
      setMembers((prev) => {
        if (prev.length <= 1) return prev;
        const nextMembers = prev.filter((m) => m.id !== memberId);
        saveMembers(nextMembers);

        if (activeMember.id === memberId && nextMembers[0]) {
          setActiveMemberId(nextMembers[0].id);
          saveActiveMemberId(nextMembers[0].id);
        }

        setMissionsByMember((prevMissions) => {
          const nextMissions: MultiMemberMissionsStore = { ...prevMissions };
          delete nextMissions[memberId];
          saveMissionsByMember(nextMissions);
          return nextMissions;
        });

        const nextStore: MultiMemberAllowanceStore = { ...recordsByMember };
        delete nextStore[memberId];
        setRecordsByMember(nextStore);

        const nextAdjustments = allAdjustments.filter((a) => a.memberId !== memberId);
        setAllAdjustments(nextAdjustments);

        void deleteMemberDataInDb(memberId, nextStore, nextAdjustments);

        return nextMembers;
      });
    },
    [activeMember.id, recordsByMember, allAdjustments]
  );

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
      const memberId = activeMember.id;
      const memberRecords = recordsByMember[memberId] ?? {};
      const prevDayAmount = memberRecords[dateKey]?.totalAmount ?? 0;
      const previousBalance = calculateBalanceSummary(
        memberRecords,
        activeAdjustments
      ).currentBalance;
      const delta = totalAmount - prevDayAmount;
      const nextBalance = previousBalance + delta;

      const nextMemberRecords: AllowanceStore = { ...memberRecords };
      const hasAnyCompleted = Object.values(items).some((item) => item.completed);
      let savedRecord: DailyAllowanceRecord | null = null;

      if (!hasAnyCompleted && totalAmount === 0) {
        delete nextMemberRecords[dateKey];
      } else {
        savedRecord = {
          id: buildRecordCompositeId(memberId, dateKey),
          memberId,
          dateKey,
          items,
          totalAmount,
          updatedAt: new Date().toISOString(),
        };
        nextMemberRecords[dateKey] = savedRecord;
      }

      const nextStore: MultiMemberAllowanceStore = {
        ...recordsByMember,
        [memberId]: nextMemberRecords,
      };
      setRecordsByMember(nextStore);
      void upsertDailyRecordInDb(savedRecord, memberId, dateKey, nextStore);

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
    [activeMember.id, recordsByMember, activeAdjustments, triggerFeedback]
  );

  const handleSaveBulk = useCallback(
    (
      dateKeys: string[],
      items: Record<string, MissionEntryState>,
      dailyTotalAmount: number
    ) => {
      const memberId = activeMember.id;
      const memberRecords = recordsByMember[memberId] ?? {};
      const previousBalance = calculateBalanceSummary(
        memberRecords,
        activeAdjustments
      ).currentBalance;
      const nextMemberRecords: AllowanceStore = { ...memberRecords };
      const hasAnyCompleted = Object.values(items).some((item) => item.completed);
      const nowIso = new Date().toISOString();
      const dateDeltas: Record<string, number> = {};
      const upserts: DailyAllowanceRecord[] = [];
      const deleteCompositeIds: string[] = [];
      let totalDelta = 0;

      for (const dateKey of dateKeys) {
        const prevDayAmount = memberRecords[dateKey]?.totalAmount ?? 0;
        const newDayAmount = !hasAnyCompleted && dailyTotalAmount === 0 ? 0 : dailyTotalAmount;
        const dayDelta = newDayAmount - prevDayAmount;
        dateDeltas[dateKey] = dayDelta;
        totalDelta += dayDelta;

        if (!hasAnyCompleted && dailyTotalAmount === 0) {
          delete nextMemberRecords[dateKey];
          deleteCompositeIds.push(buildRecordCompositeId(memberId, dateKey));
        } else {
          const rec: DailyAllowanceRecord = {
            id: buildRecordCompositeId(memberId, dateKey),
            memberId,
            dateKey,
            items: Object.fromEntries(
              Object.entries(items).map(([k, v]) => [k, { ...v }])
            ),
            totalAmount: dailyTotalAmount,
            updatedAt: nowIso,
          };
          nextMemberRecords[dateKey] = rec;
          upserts.push(rec);
        }
      }

      const nextStore: MultiMemberAllowanceStore = {
        ...recordsByMember,
        [memberId]: nextMemberRecords,
      };
      setRecordsByMember(nextStore);
      void upsertBulkRecordsInDb(upserts, deleteCompositeIds, nextStore);

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
    [activeMember.id, recordsByMember, activeAdjustments, triggerFeedback]
  );

  // --- 対象者別ミッション項目 CRUD（localStorage管理） ---
  const handleAddMission = useCallback(
    (input: Omit<MissionDefinition, 'id' | 'imagePath'>) => {
      const memberId = activeMember.id;
      setMissionsByMember((prev) => {
        const currentList = prev[memberId] ?? cloneDefaultMissions(MISSIONS_DATA);
        const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const nextList: MissionDefinition[] = [
          ...currentList,
          {
            ...input,
            id,
            /* TODO: 画像差し替え用パス */
            imagePath: '',
          },
        ];
        const nextStore: MultiMemberMissionsStore = { ...prev, [memberId]: nextList };
        saveMissionsByMember(nextStore);
        return nextStore;
      });
    },
    [activeMember.id]
  );

  const handleUpdateMission = useCallback(
    (updated: MissionDefinition) => {
      const memberId = activeMember.id;
      setMissionsByMember((prev) => {
        const currentList = prev[memberId] ?? cloneDefaultMissions(MISSIONS_DATA);
        const nextList = currentList.map((m) => (m.id === updated.id ? updated : m));
        const nextStore: MultiMemberMissionsStore = { ...prev, [memberId]: nextList };
        saveMissionsByMember(nextStore);
        return nextStore;
      });
    },
    [activeMember.id]
  );

  const handleDeleteMission = useCallback(
    (missionId: string) => {
      const memberId = activeMember.id;
      setMissionsByMember((prev) => {
        const currentList = prev[memberId] ?? cloneDefaultMissions(MISSIONS_DATA);
        if (currentList.length <= 1) return prev;
        const nextList = currentList.filter((m) => m.id !== missionId);
        const nextStore: MultiMemberMissionsStore = { ...prev, [memberId]: nextList };
        saveMissionsByMember(nextStore);
        return nextStore;
      });
    },
    [activeMember.id]
  );

  // --- 任意金額調整（IndexedDB管理） ---
  const handleAddAdjustment = useCallback(
    (input: Omit<AllowanceAdjustment, 'id' | 'createdAt'>) => {
      const newAdjustment: AllowanceAdjustment = {
        ...input,
        memberId: input.memberId || activeMember.id,
        id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setAllAdjustments((prev) => {
        const next = [newAdjustment, ...prev];
        void addAdjustmentInDb(newAdjustment, next);
        return next;
      });
    },
    [activeMember.id]
  );

  const handleDeleteAdjustment = useCallback((adjustmentId: string) => {
    setAllAdjustments((prev) => {
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
          key={`${activeMember.id}-${selectedDateKey}`}
          dateKey={selectedDateKey}
          activeMember={activeMember}
          missions={activeMissions}
          existingRecord={activeRecords[selectedDateKey]}
          onBack={handleBackFromRegister}
          onSave={handleSaveDay}
        />
      ) : screen === 'bulk-register' ? (
        <BulkRegisterView
          key={`bulk-${activeMember.id}`}
          activeMember={activeMember}
          missions={activeMissions}
          records={activeRecords}
          onBack={() => setScreen('calendar')}
          onSaveBulk={handleSaveBulk}
        />
      ) : screen === 'ledger' ? (
        <LedgerView
          activeMember={activeMember}
          records={activeRecords}
          adjustments={activeAdjustments}
          missions={activeMissions}
          onSelectDate={handleSelectDateFromLedger}
          onOpenAnalytics={() => setScreen('analytics')}
          onOpenSettings={() => setScreen('settings')}
          onBack={() => setScreen('calendar')}
        />
      ) : screen === 'analytics' ? (
        <AnalyticsView
          activeMember={activeMember}
          records={activeRecords}
          missions={activeMissions}
          onBack={() => setScreen('ledger')}
        />
      ) : screen === 'settings' ? (
        <SettingsView
          members={members}
          activeMember={activeMember}
          missions={activeMissions}
          missionsByMember={missionsByMember}
          records={activeRecords}
          adjustments={activeAdjustments}
          recordsByMember={recordsByMember}
          allAdjustments={allAdjustments}
          onSelectMember={handleSelectMember}
          onAddMember={handleAddMember}
          onUpdateMember={handleUpdateMember}
          onDeleteMember={handleDeleteMember}
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
          members={members}
          activeMember={activeMember}
          records={activeRecords}
          adjustments={activeAdjustments}
          feedback={registrationFeedback}
          theme={theme}
          onSelectMember={handleSelectMember}
          onAddMember={handleAddMember}
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
