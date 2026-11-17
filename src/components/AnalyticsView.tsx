import React, { useMemo, useState } from 'react';
import { ArrowLeft, PieChart, TrendingUp } from 'lucide-react';
import { ANALYTICS_CHART_COLORS } from '../data/missions';
import { AllowanceMember, AllowanceStore, MissionDefinition } from '../types/allowance';
import { formatYen } from '../utils/storage';

interface AnalyticsViewProps {
  activeMember: AllowanceMember;
  records: AllowanceStore;
  missions: MissionDefinition[];
  onBack: () => void;
}

interface MissionSlice {
  id: string;
  title: string;
  emoji: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
}

interface MonthlyBar {
  yearMonth: string; // YYYY-MM
  shortLabel: string; // e.g. 11月
  fullLabel: string; // e.g. 2026年11月
  amount: number;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  activeMember,
  records,
  missions,
  onBack,
}) => {
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  // ミッション別内訳データ
  const breakdown = useMemo(() => {
    const missionMap = new Map(missions.map((m) => [m.id, m]));
    const totals = new Map<
      string,
      { id: string; title: string; emoji: string; amount: number; count: number }
    >();

    let grandTotal = 0;

    for (const record of Object.values(records)) {
      for (const [missionId, entry] of Object.entries(record.items)) {
        if (!entry.completed) continue;
        const mission = missionMap.get(missionId);
        const title = entry.titleSnapshot ?? mission?.title ?? missionId;
        const unitAmount = entry.amountSnapshot ?? mission?.amount ?? 0;
        const multiplier = Math.max(1, entry.multiplier);
        const subtotal = unitAmount * multiplier;
        if (subtotal <= 0) continue;

        grandTotal += subtotal;
        const existing = totals.get(missionId);
        if (existing) {
          existing.amount += subtotal;
          existing.count += multiplier;
        } else {
          totals.set(missionId, {
            id: missionId,
            title,
            emoji: mission?.emoji ?? '✨',
            amount: subtotal,
            count: multiplier,
          });
        }
      }
    }

    const sorted = Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
    const slices: MissionSlice[] = sorted.map((item, idx) => ({
      ...item,
      percentage: grandTotal > 0 ? (item.amount / grandTotal) * 100 : 0,
      color: ANALYTICS_CHART_COLORS[idx % ANALYTICS_CHART_COLORS.length],
    }));

    return { slices, grandTotal };
  }, [records, missions]);

  // 過去1年間の月別獲得金額データ（直近12ヶ月）
  const monthlySeries = useMemo(() => {
    const now = new Date();
    const bars: MonthlyBar[] = [];
    const monthTotals = new Map<string, number>();

    for (const record of Object.values(records)) {
      const ym = record.dateKey.slice(0, 7);
      monthTotals.set(ym, (monthTotals.get(ym) ?? 0) + (record.totalAmount || 0));
    }

    for (let offset = 11; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      bars.push({
        yearMonth: ym,
        shortLabel: `${m}`,
        fullLabel: `${y}年${m}月`,
        amount: monthTotals.get(ym) ?? 0,
      });
    }

    const maxAmount = Math.max(100, ...bars.map((b) => b.amount));
    const yearTotal = bars.reduce((s, b) => s + b.amount, 0);

    return { bars, maxAmount, yearTotal };
  }, [records]);

  const activeSlice = useMemo(
    () => breakdown.slices.find((s) => s.id === selectedSliceId) ?? null,
    [breakdown.slices, selectedSliceId]
  );

  const activeBar = useMemo(
    () =>
      monthlySeries.bars.find((b) => b.yearMonth === selectedMonthKey) ??
      monthlySeries.bars[monthlySeries.bars.length - 1],
    [monthlySeries.bars, selectedMonthKey]
  );

  // SVG Donut Geometry (r = 76, circumference = 2 * pi * 76)
  const radius = 76;
  const circumference = 2 * Math.PI * radius;

  const donutSegments = useMemo(() => {
    let accumulatedRatio = 0;
    return breakdown.slices.map((slice) => {
      const ratio = breakdown.grandTotal > 0 ? slice.amount / breakdown.grandTotal : 0;
      const dashLength = ratio * circumference;
      const dashOffset = -accumulatedRatio * circumference;
      accumulatedRatio += ratio;
      return {
        slice,
        dashArray: `${dashLength} ${circumference}`,
        dashOffset,
      };
    });
  }, [breakdown.slices, breakdown.grandTotal, circumference]);

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#FAF9F6]/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"
              aria-hidden="true"
            >
              <PieChart className="h-4 w-4" />
            </span>
            <h1 className="font-display truncate text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
              {activeMember.emoji} {activeMember.name}の分析
            </h1>
          </div>
          <span className="font-numeric shrink-0 text-xs font-medium text-stone-500 dark:text-stone-400">
            累計 {formatYen(breakdown.grandTotal)}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-28 sm:px-6 sm:pt-6 space-y-6">
        {/* Section 1: ミッション別内訳（円グラフ） */}
        <section
          aria-label="ミッション別の内訳"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
              ミッション別の獲得内訳
            </h2>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              タップで詳細表示
            </span>
          </div>

          {breakdown.slices.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
                まだ達成されたミッションがありません
              </p>
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                ミッションを記録すると円グラフが表示されます
              </p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 items-center gap-6 sm:grid-cols-12">
              {/* SVG Donut Chart */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center">
                <div className="relative h-52 w-52">
                  <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      strokeWidth="28"
                      className="stroke-stone-100 dark:stroke-stone-800"
                    />
                    {donutSegments.map(({ slice, dashArray, dashOffset }) => {
                      const isDimmed =
                        selectedSliceId !== null && selectedSliceId !== slice.id;
                      return (
                        <circle
                          key={slice.id}
                          cx="100"
                          cy="100"
                          r={radius}
                          fill="none"
                          stroke={slice.color}
                          strokeWidth={selectedSliceId === slice.id ? 33 : 28}
                          strokeDasharray={dashArray}
                          strokeDashoffset={dashOffset}
                          onClick={() =>
                            setSelectedSliceId((prev) =>
                              prev === slice.id ? null : slice.id
                            )
                          }
                          className="cursor-pointer transition-all duration-200"
                          style={{ opacity: isDimmed ? 0.35 : 1 }}
                        />
                      );
                    })}
                  </svg>

                  {/* Center Readout */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                    <p className="max-w-full truncate text-[11px] font-bold text-stone-500 dark:text-stone-400">
                      {activeSlice ? activeSlice.title : 'ミッション合計'}
                    </p>
                    <p className="font-numeric mt-0.5 text-xl font-bold text-stone-900 dark:text-stone-100">
                      {formatYen(activeSlice ? activeSlice.amount : breakdown.grandTotal)}
                    </p>
                    {activeSlice && (
                      <p className="font-numeric text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {activeSlice.percentage.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Legend List */}
              <div className="sm:col-span-7 divide-y divide-stone-100 dark:divide-stone-800">
                {breakdown.slices.map((slice) => {
                  const isSelected = selectedSliceId === slice.id;
                  return (
                    <button
                      key={slice.id}
                      type="button"
                      onClick={() =>
                        setSelectedSliceId((prev) =>
                          prev === slice.id ? null : slice.id
                        )
                      }
                      className={`flex min-h-[44px] w-full items-center justify-between gap-3 px-2 py-2.5 text-left transition-colors rounded-lg ${
                        isSelected
                          ? 'bg-stone-100 dark:bg-stone-800'
                          : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: slice.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate text-sm font-bold text-stone-800 dark:text-stone-200">
                          {slice.emoji} {slice.title}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-2">
                        <span className="font-numeric text-sm font-bold text-stone-900 dark:text-stone-100">
                          {formatYen(slice.amount)}
                        </span>
                        <span className="font-numeric w-11 text-right text-xs font-medium text-stone-500 dark:text-stone-400">
                          {slice.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Section 2: 過去1年間の月別獲得金額（棒グラフ） */}
        <section
          aria-label="過去1年間の月別おこづかい獲得金額"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                  過去1年間の月別獲得金額
                </h2>
              </div>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                直近12ヶ月合計:{' '}
                <strong className="font-numeric text-stone-800 dark:text-stone-200">
                  {formatYen(monthlySeries.yearTotal)}
                </strong>
              </p>
            </div>

            {activeBar && (
              <div className="text-right">
                <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                  {activeBar.fullLabel}
                </p>
                <p className="font-numeric text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  {formatYen(activeBar.amount)}
                </p>
              </div>
            )}
          </div>

          {/* 12-Month Bar Chart */}
          <div className="mt-6">
            <div className="grid h-44 grid-cols-12 items-end gap-1.5 sm:gap-2 border-b border-stone-200 pb-2 dark:border-stone-800">
              {monthlySeries.bars.map((bar) => {
                const heightPct =
                  bar.amount > 0
                    ? Math.max(8, Math.round((bar.amount / monthlySeries.maxAmount) * 100))
                    : 3;
                const isSelected = activeBar?.yearMonth === bar.yearMonth;

                return (
                  <button
                    key={bar.yearMonth}
                    type="button"
                    onClick={() => setSelectedMonthKey(bar.yearMonth)}
                    aria-label={`${bar.fullLabel}: ${formatYen(bar.amount)}`}
                    className="group flex h-full flex-col items-center justify-end focus-visible:outline-none"
                  >
                    <div
                      className={`w-full max-w-[26px] rounded-t-md transition-all duration-200 ${
                        bar.amount === 0
                          ? 'bg-stone-200 dark:bg-stone-800'
                          : isSelected
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : 'bg-emerald-600/75 group-hover:bg-emerald-500 dark:bg-emerald-700/80 dark:group-hover:bg-emerald-500'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Month Labels */}
            <div className="mt-2 grid grid-cols-12 gap-1.5 sm:gap-2 text-center">
              {monthlySeries.bars.map((bar) => {
                const isSelected = activeBar?.yearMonth === bar.yearMonth;
                return (
                  <button
                    key={`lbl-${bar.yearMonth}`}
                    type="button"
                    onClick={() => setSelectedMonthKey(bar.yearMonth)}
                    className={`font-numeric text-[11px] font-bold ${
                      isSelected
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    {bar.shortLabel}
                    <span className="hidden sm:inline">月</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-right text-[11px] text-stone-400 dark:text-stone-500">
              ※棒をタップすると各月の金額を確認できます
            </p>
          </div>
        </section>
      </main>

      {/* Bottom Sticky Back Button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-md pb-safe dark:border-stone-800 dark:bg-stone-900/95">
        <div className="mx-auto max-w-3xl px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-bold text-stone-800 transition-colors hover:bg-stone-100 active:scale-[0.99] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>もどる</span>
          </button>
        </div>
      </div>
    </div>
  );
};
