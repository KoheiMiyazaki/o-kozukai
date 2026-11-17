import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Minus, RotateCcw } from 'lucide-react';
import { APP_CONFIG } from '../data/missions';
import {
  AllowanceMember,
  DailyAllowanceRecord,
  MissionDefinition,
  MissionEntryState,
} from '../types/allowance';
import {
  calculateTotalFromItems,
  createInitialItemsState,
  formatDisplayDate,
  formatYen,
} from '../utils/storage';
import { AnimatedYen } from './AnimatedYen';

interface RegisterViewProps {
  dateKey: string;
  activeMember: AllowanceMember;
  missions: MissionDefinition[];
  existingRecord?: DailyAllowanceRecord;
  onBack: () => void;
  onSave: (
    dateKey: string,
    items: Record<string, MissionEntryState>,
    totalAmount: number
  ) => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  dateKey,
  activeMember,
  missions,
  existingRecord,
  onBack,
  onSave,
}) => {
  const [items, setItems] = useState<Record<string, MissionEntryState>>(() =>
    createInitialItemsState(existingRecord, missions)
  );

  const totalAmount = useMemo(
    () => calculateTotalFromItems(items, missions),
    [items, missions]
  );

  const completedCount = useMemo(
    () => Object.values(items).filter((entry) => entry.completed).length,
    [items]
  );

  // 「x1」ボタンタップで倍率を上げる（x1, x2, x3, ...）
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

  // 倍率が2以上のときに1つ戻せる補助ボタン
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

  // 最右側の「達成」ボタンタップで金額の記録を切り替え
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

  const handleResetDay = () => {
    setItems(createInitialItemsState(undefined, missions));
  };

  const handleSubmit = () => {
    onSave(dateKey, items, totalAmount);
  };

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {/* Compact Sticky Top Bar */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#FAF9F6]/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-[76px] items-center">
            <span className="truncate text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {activeMember.emoji} {activeMember.name}
            </span>
          </div>

          <h1 className="font-display truncate text-center text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
            {formatDisplayDate(dateKey)}
          </h1>

          <button
            type="button"
            onClick={handleResetDay}
            disabled={completedCount === 0 && Object.values(items).every((e) => e.multiplier === 1)}
            className="flex min-h-[44px] min-w-[76px] items-center justify-end gap-1 rounded-xl px-2 text-xs font-bold text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-35 whitespace-nowrap shrink-0 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-rose-400"
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>リセット</span>
          </button>
        </div>
      </header>

      {/* Main Mission List */}
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-32 sm:px-6 sm:pt-6">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-stone-700 dark:text-stone-300">
            ミッション一覧
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            <span className="font-numeric font-bold text-stone-700 dark:text-stone-200">
              {completedCount}
            </span>{' '}
            / <span className="font-numeric">{missions.length}</span> 件達成
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
                {/* Left: On-memory Icon + Mission Title & Amount */}
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

                {/* Right: Optional [-] + Multiplier [x1, x2...] + [達成] Button */}
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

        <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
          「x1」ボタンをタップすると数量（x2, x3…）が増えます。最後に「登録する」を押して保存してください。
        </p>
      </main>

      {/* Sticky Bottom Real-Time Total, Back & Register CTA (Thumb Zone) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-md pb-safe dark:border-stone-800 dark:bg-stone-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2.5 px-4 py-2.5 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400">
              この日の合計
            </p>
            <p
              className={`font-numeric text-xl sm:text-2xl font-bold leading-tight ${
                totalAmount > 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-stone-900 dark:text-stone-100'
              }`}
            >
              <AnimatedYen value={totalAmount} durationMs={260} />
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
              onClick={handleSubmit}
              className="flex min-h-[48px] items-center justify-center rounded-xl bg-emerald-600 px-5 sm:px-7 text-sm sm:text-base font-bold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              登録する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
