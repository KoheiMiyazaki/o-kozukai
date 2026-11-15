import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarRange, Check, Minus, RotateCcw } from 'lucide-react';
import { APP_CONFIG } from '../data/missions';
import {
  AllowanceStore,
  MissionDefinition,
  MissionEntryState,
} from '../types/allowance';
import {
  calculateTotalFromItems,
  createInitialItemsState,
  enumerateDateKeys,
  formatDateKey,
  formatFullDisplayDate,
  formatYen,
} from '../utils/storage';
import { AnimatedYen } from './AnimatedYen';

interface BulkRegisterViewProps {
  missions: MissionDefinition[];
  records: AllowanceStore;
  onBack: () => void;
  onSaveBulk: (
    dateKeys: string[],
    items: Record<string, MissionEntryState>,
    dailyTotalAmount: number
  ) => void;
}

export const BulkRegisterView: React.FC<BulkRegisterViewProps> = ({
  missions,
  records,
  onBack,
  onSaveBulk,
}) => {
  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const [startDateKey, setStartDateKey] = useState(todayKey);
  const [endDateKey, setEndDateKey] = useState(todayKey);
  const [items, setItems] = useState<Record<string, MissionEntryState>>(() =>
    createInitialItemsState(undefined, missions)
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [conflictingDateKeys, setConflictingDateKeys] = useState<string[] | null>(null);

  const dateKeys = useMemo(
    () => enumerateDateKeys(startDateKey, endDateKey),
    [startDateKey, endDateKey]
  );

  const isInvalidOrder = Boolean(startDateKey && endDateKey && startDateKey > endDateKey);

  const dailyTotalAmount = useMemo(
    () => calculateTotalFromItems(items, missions),
    [items, missions]
  );

  const grandBulkTotal = dailyTotalAmount * dateKeys.length;

  const completedCount = useMemo(
    () => Object.values(items).filter((entry) => entry.completed).length,
    [items]
  );

  const handleIncrementMultiplier = (mission: MissionDefinition) => {
    setItems((prev) => {
      const current = prev[mission.id] ?? {
        completed: false,
        multiplier: 1,
        titleSnapshot: mission.title,
        amountSnapshot: mission.amount,
      };
      const nextMultiplier = Math.min(APP_CONFIG.maxMultiplier, current.multiplier + 1);
      return {
        ...prev,
        [mission.id]: {
          ...current,
          multiplier: nextMultiplier,
          titleSnapshot: mission.title,
          amountSnapshot: mission.amount,
        },
      };
    });
  };

  const handleDecrementMultiplier = (mission: MissionDefinition) => {
    setItems((prev) => {
      const current = prev[mission.id] ?? {
        completed: false,
        multiplier: 1,
        titleSnapshot: mission.title,
        amountSnapshot: mission.amount,
      };
      const nextMultiplier = Math.max(1, current.multiplier - 1);
      return {
        ...prev,
        [mission.id]: {
          ...current,
          multiplier: nextMultiplier,
          titleSnapshot: mission.title,
          amountSnapshot: mission.amount,
        },
      };
    });
  };

  const handleToggleComplete = (mission: MissionDefinition) => {
    setItems((prev) => {
      const current = prev[mission.id] ?? {
        completed: false,
        multiplier: 1,
        titleSnapshot: mission.title,
        amountSnapshot: mission.amount,
      };
      return {
        ...prev,
        [mission.id]: {
          ...current,
          completed: !current.completed,
          titleSnapshot: mission.title,
          amountSnapshot: mission.amount,
        },
      };
    });
  };

  const handleReset = () => {
    setItems(createInitialItemsState(undefined, missions));
    setErrorMessage('');
  };

  const handleRequestSubmit = () => {
    if (!startDateKey || !endDateKey) {
      setErrorMessage('開始日と終了日を指定してください');
      return;
    }
    if (isInvalidOrder) {
      setErrorMessage('開始日は終了日以前の日付を指定してください');
      return;
    }
    if (dateKeys.length === 0) {
      setErrorMessage('有効な期間を指定してください');
      return;
    }

    setErrorMessage('');

    const conflicts = dateKeys.filter((key) => {
      const rec = records[key];
      if (!rec) return false;
      return rec.totalAmount > 0 || Object.values(rec.items).some((entry) => entry.completed);
    });

    if (conflicts.length > 0) {
      setConflictingDateKeys(conflicts);
      return;
    }

    onSaveBulk(dateKeys, items, dailyTotalAmount);
  };

  const handleConfirmOverwrite = () => {
    setConflictingDateKeys(null);
    onSaveBulk(dateKeys, items, dailyTotalAmount);
  };

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {/* Compact Sticky Top Bar */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#FAF9F6]/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-[76px] items-center">
            <CalendarRange
              className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
          </div>

          <h1 className="font-display truncate text-center text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
            期間一括登録
          </h1>

          <button
            type="button"
            onClick={handleReset}
            disabled={completedCount === 0 && Object.values(items).every((e) => e.multiplier === 1)}
            className="flex min-h-[44px] min-w-[76px] items-center justify-end gap-1 rounded-xl px-2 text-xs font-bold text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-35 whitespace-nowrap shrink-0 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-rose-400"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>リセット</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-32 sm:px-6 sm:pt-6 space-y-5">
        {/* Date Range Card */}
        <section
          aria-label="登録する期間の指定"
          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
              期間の指定
            </h2>
            {!isInvalidOrder && dateKeys.length > 0 && (
              <span className="font-numeric text-xs font-bold text-emerald-700 dark:text-emerald-400">
                対象 {dateKeys.length}日間
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="bulk-start-date"
                className="block text-xs font-bold text-stone-600 dark:text-stone-400"
              >
                開始日
              </label>
              <input
                id="bulk-start-date"
                type="date"
                value={startDateKey}
                onChange={(e) => {
                  setStartDateKey(e.target.value);
                  setErrorMessage('');
                }}
                className="font-numeric mt-1 min-h-[44px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm font-medium text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </div>

            <div>
              <label
                htmlFor="bulk-end-date"
                className="block text-xs font-bold text-stone-600 dark:text-stone-400"
              >
                終了日
              </label>
              <input
                id="bulk-end-date"
                type="date"
                value={endDateKey}
                onChange={(e) => {
                  setEndDateKey(e.target.value);
                  setErrorMessage('');
                }}
                className="font-numeric mt-1 min-h-[44px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm font-medium text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </div>
          </div>

          {(isInvalidOrder || errorMessage) && (
            <p
              role="alert"
              className="mt-2.5 text-xs font-bold text-rose-600 dark:text-rose-400"
            >
              {errorMessage || '開始日は終了日以前の日付を指定してください'}
            </p>
          )}
        </section>

        {/* Mission List */}
        <section aria-label="一括登録するミッション一覧">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-stone-700 dark:text-stone-300">
              ミッション一覧（1日あたり）
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              <span className="font-numeric font-bold text-stone-700 dark:text-stone-200">
                {completedCount}
              </span>{' '}
              / <span className="font-numeric">{missions.length}</span> 件選択中
            </p>
          </div>

          <div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
            {missions.map((mission) => {
              const entry = items[mission.id] ?? { completed: false, multiplier: 1 };
              const subtotal = mission.amount * entry.multiplier;

              return (
                <div
                  key={mission.id}
                  className={`flex items-center justify-between gap-2.5 px-3.5 py-3.5 sm:px-5 sm:py-4 transition-colors ${
                    entry.completed
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/35'
                      : 'bg-white dark:bg-stone-900'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${mission.accentBgClass}`}
                      aria-hidden="true"
                    >
                      {mission.emoji}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                        {mission.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-stone-500 dark:text-stone-400">
                        <span className="font-numeric font-bold text-stone-700 dark:text-stone-300">
                          {formatYen(mission.amount)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{mission.unitLabel}</span>
                        {entry.completed ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-numeric font-bold text-emerald-700 dark:text-emerald-400">
                              +{formatYen(subtotal)}
                            </span>
                          </>
                        ) : entry.multiplier > 1 ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-numeric font-medium text-amber-700 dark:text-amber-400">
                              達成時 {formatYen(subtotal)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    {entry.multiplier > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDecrementMultiplier(mission)}
                        aria-label={`${mission.title}の倍率を減らす`}
                        className="flex min-h-[44px] min-w-[36px] items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-100 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleIncrementMultiplier(mission)}
                      aria-label={`${mission.title}の倍率を増やす（現在 ${entry.multiplier}倍）`}
                      className={`font-numeric flex min-h-[44px] min-w-[48px] items-center justify-center rounded-xl border px-2.5 text-sm font-bold transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                        entry.multiplier > 1
                          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700/80 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-950'
                          : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      x{entry.multiplier}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleComplete(mission)}
                      aria-pressed={entry.completed}
                      className={`flex min-h-[44px] min-w-[76px] sm:min-w-[90px] items-center justify-center gap-1 rounded-xl border-2 px-3 text-sm font-bold transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                        entry.completed
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs hover:border-emerald-700 hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:border-emerald-400 dark:hover:bg-emerald-500'
                          : 'border-emerald-600 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:bg-stone-900 dark:text-emerald-400 dark:hover:bg-emerald-950/60'
                      }`}
                    >
                      {entry.completed && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      <span>{entry.completed ? '達成済' : '達成'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Sticky Bottom Real-Time Total, Back & Bulk Register CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-md pb-safe dark:border-stone-800 dark:bg-stone-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2.5 px-4 py-2.5 sm:px-6">
          <div className="min-w-0">
            <p className="font-numeric truncate text-[11px] font-bold text-stone-500 dark:text-stone-400">
              {formatYen(dailyTotalAmount)} × {dateKeys.length}日
            </p>
            <p
              className={`font-numeric text-xl sm:text-2xl font-bold leading-tight ${
                grandBulkTotal > 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-stone-900 dark:text-stone-100'
              }`}
            >
              <AnimatedYen value={grandBulkTotal} durationMs={260} />
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex min-h-[48px] items-center justify-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm font-bold text-stone-700 transition-colors hover:bg-stone-100 active:scale-[0.98] whitespace-nowrap shrink-0 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>もどる</span>
            </button>

            <button
              type="button"
              onClick={handleRequestSubmit}
              className="flex min-h-[48px] items-center justify-center rounded-xl bg-emerald-600 px-4 sm:px-6 text-sm sm:text-base font-bold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              一括登録する
            </button>
          </div>
        </div>
      </div>

      {/* Overwrite Warning Modal */}
      {conflictingDateKeys && conflictingDateKeys.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/70 p-4 backdrop-blur-xs sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="overwrite-warning-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400"
                aria-hidden="true"
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3
                  id="overwrite-warning-title"
                  className="font-display text-base font-bold text-stone-900 dark:text-stone-100"
                >
                  すでに入力がある日付が含まれています
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                  以下の日付にはすでに記録があります。今回の内容で上書きしてもよろしいですか？
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 dark:border-stone-800 dark:bg-stone-950">
              <ul className="divide-y divide-stone-200/70 dark:divide-stone-800">
                {conflictingDateKeys.map((conflictKey) => (
                  <li
                    key={conflictKey}
                    className="font-numeric py-1.5 text-sm font-bold text-stone-800 dark:text-stone-200"
                  >
                    {formatFullDisplayDate(conflictKey)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConflictingDateKeys(null)}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmOverwrite}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-bold text-white transition-colors hover:bg-amber-500"
              >
                上書きして登録
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
