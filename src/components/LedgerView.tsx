import React, { useMemo } from 'react';
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  MinusCircle,
  PlusCircle,
  Settings,
  Wallet,
} from 'lucide-react';
import {
  AllowanceAdjustment,
  AllowanceStore,
  MissionDefinition,
} from '../types/allowance';
import {
  calculateBalanceSummary,
  formatFullDisplayDate,
  formatYen,
} from '../utils/storage';

interface LedgerViewProps {
  records: AllowanceStore;
  adjustments: AllowanceAdjustment[];
  missions: MissionDefinition[];
  onSelectDate: (dateKey: string) => void;
  onOpenAnalytics: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
}

type HistoryItem =
  | {
      kind: 'mission-day';
      id: string;
      dateKey: string;
      sortTime: string;
      amount: number;
      summaryText: string;
      itemCount: number;
    }
  | {
      kind: 'adjustment';
      id: string;
      dateKey: string;
      sortTime: string;
      type: 'add' | 'subtract';
      amount: number;
      memo: string;
    };

export const LedgerView: React.FC<LedgerViewProps> = ({
  records,
  adjustments,
  missions,
  onSelectDate,
  onOpenAnalytics,
  onOpenSettings,
  onBack,
}) => {
  const balance = useMemo(
    () => calculateBalanceSummary(records, adjustments),
    [records, adjustments]
  );

  const historyItems = useMemo<HistoryItem[]>(() => {
    const missionMap = new Map(missions.map((m) => [m.id, m]));
    const items: HistoryItem[] = [];

    for (const record of Object.values(records)) {
      if (record.totalAmount <= 0) continue;
      const completedLabels: string[] = [];
      let count = 0;

      for (const [missionId, entry] of Object.entries(record.items)) {
        if (!entry.completed) continue;
        count += 1;
        const mission = missionMap.get(missionId);
        const title = entry.titleSnapshot ?? mission?.title ?? missionId;
        completedLabels.push(entry.multiplier > 1 ? `${title} ×${entry.multiplier}` : title);
      }

      if (count > 0) {
        items.push({
          kind: 'mission-day',
          id: `day-${record.dateKey}`,
          dateKey: record.dateKey,
          sortTime: record.updatedAt || `${record.dateKey}T23:59:59`,
          amount: record.totalAmount,
          summaryText: completedLabels.join('、'),
          itemCount: count,
        });
      }
    }

    for (const adj of adjustments) {
      items.push({
        kind: 'adjustment',
        id: `adj-${adj.id}`,
        dateKey: adj.dateKey,
        sortTime: adj.createdAt || `${adj.dateKey}T23:59:59`,
        type: adj.type,
        amount: adj.amount,
        memo: adj.memo || (adj.type === 'add' ? 'おこづかい追加' : 'おこづかい利用'),
      });
    }

    items.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? 1 : -1;
      return a.sortTime < b.sortTime ? 1 : -1;
    });

    return items;
  }, [records, adjustments, missions]);

  const recentHistoryItems = useMemo(() => historyItems.slice(0, 5), [historyItems]);

  return (
    <div className="flex min-h-dvh flex-col bg-[#FAF9F6] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#FAF9F6]/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"
              aria-hidden="true"
            >
              <Wallet className="h-4 w-4" />
            </span>
            <h1 className="font-display text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
              お小遣い帳
            </h1>
          </div>
          <span className="font-numeric text-xs font-medium text-stone-500 dark:text-stone-400">
            最新 {recentHistoryItems.length}件
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 sm:px-6 sm:py-6 space-y-5">
        {/* Current Balance Card */}
        <section
          aria-label="現在のおこづかい合計"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900"
        >
          <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
            現在のおこづかい合計
          </p>
          <p
            className={`font-numeric mt-2 text-4xl font-bold tracking-tight ${
              balance.currentBalance < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {formatYen(balance.currentBalance)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600 dark:text-stone-400">
            <span>
              ミッション獲得{' '}
              <strong className="font-numeric text-stone-900 dark:text-stone-200">
                {formatYen(balance.missionTotal)}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              追加・利用調整{' '}
              <strong
                className={`font-numeric ${
                  balance.adjustmentNet > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : balance.adjustmentNet < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-stone-900 dark:text-stone-200'
                }`}
              >
                {balance.adjustmentNet > 0 ? `+${formatYen(balance.adjustmentNet)}` : formatYen(balance.adjustmentNet)}
              </strong>
            </span>
          </div>
        </section>

        {/* History List (Latest 5) */}
        <section aria-label="履歴">
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="font-display text-sm font-bold text-stone-700 dark:text-stone-300">
              履歴
            </h2>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              新しい順（最大5件）
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
            {recentHistoryItems.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
                  まだおこづかいの履歴がありません
                </p>
                <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                  カレンダーからミッションを登録するか、設定から金額を追加してください
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {recentHistoryItems.map((item) => {
                  if (item.kind === 'mission-day') {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectDate(item.dateKey)}
                        className="flex min-h-[64px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50 active:bg-stone-100 dark:hover:bg-stone-800/70 dark:active:bg-stone-800"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                            <span className="font-numeric font-semibold text-stone-700 dark:text-stone-300">
                              {formatFullDisplayDate(item.dateKey)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>ミッション {item.itemCount}件</span>
                          </div>
                          <p className="mt-0.5 truncate text-sm font-bold text-stone-900 dark:text-stone-100">
                            {item.summaryText}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="font-numeric text-base font-bold text-emerald-700 dark:text-emerald-400">
                            +{formatYen(item.amount)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-stone-400 dark:text-stone-500" aria-hidden="true" />
                        </div>
                      </button>
                    );
                  }

                  const isAdd = item.type === 'add';
                  return (
                    <div
                      key={item.id}
                      className="flex min-h-[64px] items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            isAdd
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400'
                          }`}
                          aria-hidden="true"
                        >
                          {isAdd ? (
                            <PlusCircle className="h-4 w-4" />
                          ) : (
                            <MinusCircle className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                            <span className="font-numeric font-semibold text-stone-700 dark:text-stone-300">
                              {formatFullDisplayDate(item.dateKey)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{isAdd ? '追加調整' : 'つかった'}</span>
                          </div>
                          <p className="mt-0.5 truncate text-sm font-bold text-stone-900 dark:text-stone-100">
                            {item.memo}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-numeric shrink-0 text-base font-bold ${
                          isAdd
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isAdd ? `+${formatYen(item.amount)}` : `-${formatYen(item.amount)}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Bottom Stacked Action Buttons: 分析 / 設定 / もどる */}
      <footer className="mt-auto border-t border-stone-200 bg-white/95 backdrop-blur-md pb-safe dark:border-stone-800 dark:bg-stone-900/95">
        <div className="mx-auto flex max-w-3xl flex-col gap-2.5 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onOpenAnalytics}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-500 active:scale-[0.99]"
          >
            <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>分析</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-bold text-stone-800 transition-colors hover:bg-stone-100 active:scale-[0.99] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>設定</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 transition-colors hover:bg-stone-50 active:scale-[0.99] dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300 dark:hover:bg-stone-900"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>もどる</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
