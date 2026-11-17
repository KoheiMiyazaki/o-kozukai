import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  Sun,
  Moon,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  UserPlus,
  X,
  Check,
} from 'lucide-react';
import { APP_CONFIG, CALENDAR_CONFIG, MEMBER_EMOJI_OPTIONS } from '../data/missions';
import {
  AllowanceAdjustment,
  AllowanceMember,
  AllowanceStore,
  RegistrationFeedback,
} from '../types/allowance';
import {
  buildCalendarGrid,
  calculateBalanceSummary,
  formatDisplayDate,
  formatDateKey,
  formatYen,
} from '../utils/storage';
import { AnimatedYen } from './AnimatedYen';
import { PWAInstallButton } from './PWAInstallButton';

interface CalendarViewProps {
  currentYear: number;
  currentMonth: number; // 0-indexed (0 = Jan)
  members: AllowanceMember[];
  activeMember: AllowanceMember;
  records: AllowanceStore;
  adjustments: AllowanceAdjustment[];
  feedback: RegistrationFeedback | null;
  theme: 'dark' | 'light';
  onSelectMember: (memberId: string) => void;
  onAddMember: (input: { name: string; emoji: string }) => void;
  onToggleTheme: () => void;
  onChangeMonth: (year: number, month: number) => void;
  onSelectDate: (dateKey: string) => void;
  onOpenBulkRegister: () => void;
  onOpenLedger: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  currentYear,
  currentMonth,
  members,
  activeMember,
  records,
  adjustments,
  feedback,
  theme,
  onSelectMember,
  onAddMember,
  onToggleTheme,
  onChangeMonth,
  onSelectDate,
  onOpenBulkRegister,
  onOpenLedger,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);

  const [showQuickAddMember, setShowQuickAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmoji, setNewMemberEmoji] = useState('👦');
  const [memberError, setMemberError] = useState('');

  const calendarCells = useMemo(
    () => buildCalendarGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const monthPrefix = useMemo(() => {
    const m = String(currentMonth + 1).padStart(2, '0');
    return `${currentYear}-${m}-`;
  }, [currentYear, currentMonth]);

  const balanceSummary = useMemo(
    () => calculateBalanceSummary(records, adjustments),
    [records, adjustments]
  );

  const monthStats = useMemo(() => {
    let totalAmount = 0;
    let activeDays = 0;
    let completedMissions = 0;

    for (const [dateKey, record] of Object.entries(records)) {
      if (!dateKey.startsWith(monthPrefix)) continue;
      if (record.totalAmount > 0) {
        totalAmount += record.totalAmount;
        activeDays += 1;
        const count = Object.values(record.items).filter((item) => item.completed).length;
        completedMissions += count;
      }
    }

    return {
      totalAmount,
      activeDays,
      completedMissions,
    };
  }, [records, monthPrefix]);

  const monthDelta = useMemo(() => {
    if (!feedback) return 0;
    return Object.entries(feedback.dateDeltas).reduce((sum, [dateKey, delta]) => {
      return dateKey.startsWith(monthPrefix) ? sum + delta : sum;
    }, 0);
  }, [feedback, monthPrefix]);

  const previousMonthTotal = feedback ? monthStats.totalAmount - monthDelta : undefined;
  const previousBalance = feedback ? feedback.previousBalance : undefined;

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      onChangeMonth(currentYear - 1, 11);
    } else {
      onChangeMonth(currentYear, currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      onChangeMonth(currentYear + 1, 0);
    } else {
      onChangeMonth(currentYear, currentMonth + 1);
    }
  };

  const handleJumpToday = () => {
    onChangeMonth(today.getFullYear(), today.getMonth());
  };

  const handleSubmitQuickAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed) {
      setMemberError('名前を入力してください');
      return;
    }
    onAddMember({ name: trimmed, emoji: newMemberEmoji });
    setNewMemberName('');
    setMemberError('');
    setShowQuickAddMember(false);
  };

  const isViewingCurrentMonth =
    currentYear === today.getFullYear() && currentMonth === today.getMonth();

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {/* Top App Bar */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#FAF9F6]/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs"
              aria-hidden="true"
            >
              <CalendarDays className="h-4 w-4" />
            </span>
            <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap truncate">
              {APP_CONFIG.appName}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="font-numeric text-xs sm:text-sm font-bold text-stone-600 dark:text-stone-300 whitespace-nowrap shrink-0">
              {formatDisplayDate(todayKey)}
            </span>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition-colors hover:bg-stone-100 active:scale-95 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-stone-700" aria-hidden="true" />
              )}
            </button>
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Floating Delta Notification on Registration */}
      {feedback && (
        <div
          key={feedback.id}
          role="status"
          aria-live="polite"
          className={`pointer-events-none fixed left-1/2 top-16 z-40 -translate-x-1/2 ${
            feedback.delta < 0 ? 'animate-delta-down' : 'animate-delta-up'
          }`}
        >
          <div
            className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold shadow-lg backdrop-blur-md whitespace-nowrap ${
              feedback.delta > 0
                ? 'border-emerald-300 bg-emerald-600/95 text-white dark:border-emerald-500/60 dark:bg-emerald-600/95'
                : feedback.delta < 0
                  ? 'border-rose-300 bg-rose-600/95 text-white dark:border-rose-500/60 dark:bg-rose-600/95'
                  : 'border-stone-200 bg-stone-800/95 text-white dark:border-stone-700 dark:bg-stone-800/95'
            }`}
          >
            {feedback.delta > 0 ? (
              <>
                <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-numeric">+{formatYen(feedback.delta)}</span>
                <span>増えました！</span>
              </>
            ) : feedback.delta < 0 ? (
              <>
                <TrendingDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-numeric">-{formatYen(Math.abs(feedback.delta))}</span>
                <span>減りました</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>登録内容を保存しました</span>
              </>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6 space-y-4">
        {/* Active Member Banner & 1-Tap Switcher */}
        <section
          aria-label="対象者の切り替え"
          className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl leading-none shrink-0" aria-hidden="true">
              {activeMember.emoji}
            </span>
            <h2 className="font-display text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 truncate">
              {activeMember.name}のお小遣い帳
            </h2>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {members.map((member) => {
              const isActive = member.id === activeMember.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onSelectMember(member.id)}
                  aria-pressed={isActive}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs sm:text-sm font-bold transition-colors active:scale-95 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800'
                  }`}
                >
                  <span aria-hidden="true">{member.emoji}</span>
                  <span>{member.name}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setNewMemberName('');
                setNewMemberEmoji('👦');
                setMemberError('');
                setShowQuickAddMember(true);
              }}
              aria-label="対象者を追加"
              className="flex min-h-[40px] items-center gap-1 rounded-xl border border-dashed border-stone-300 bg-transparent px-3 text-xs font-bold text-stone-600 transition-colors hover:border-emerald-500 hover:text-emerald-700 active:scale-95 whitespace-nowrap shrink-0 dark:border-stone-700 dark:text-stone-400 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
            >
              <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>追加</span>
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Left / Main Column: Calendar */}
          <section className="lg:col-span-8 space-y-4" aria-label="おこづかいカレンダー">
            {/* Combined Monthly Total & Overall Total Strip (Mobile & Tablet) */}
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3.5 dark:border-stone-800 dark:bg-stone-900 lg:hidden">
              <div className="grid grid-cols-2 divide-x divide-stone-100 dark:divide-stone-800">
                <div className="pr-3">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      {currentYear}年{currentMonth + 1}月合計
                    </p>
                    {feedback && monthDelta !== 0 && (
                      <span
                        className={`font-numeric text-[11px] font-bold ${
                          monthDelta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {monthDelta > 0 ? `+${formatYen(monthDelta)}` : `-${formatYen(Math.abs(monthDelta))}`}
                      </span>
                    )}
                  </div>
                  <p className="font-numeric mt-0.5 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    <AnimatedYen
                      value={monthStats.totalAmount}
                      fromValue={previousMonthTotal}
                      triggerKey={feedback?.id}
                      durationMs={520}
                    />
                  </p>
                </div>

                <div className="pl-3.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      総計
                    </p>
                    {feedback && feedback.delta !== 0 && (
                      <span
                        className={`font-numeric text-[11px] font-bold ${
                          feedback.delta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {feedback.delta > 0
                          ? `+${formatYen(feedback.delta)}`
                          : `-${formatYen(Math.abs(feedback.delta))}`}
                      </span>
                    )}
                  </div>
                  <p
                    className={`font-numeric mt-0.5 text-2xl font-bold ${
                      balanceSummary.currentBalance < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-stone-900 dark:text-stone-100'
                    }`}
                  >
                    <AnimatedYen
                      value={balanceSummary.currentBalance}
                      fromValue={previousBalance}
                      triggerKey={feedback?.id}
                      durationMs={520}
                    />
                  </p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-3 border-t border-stone-100 pt-2 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
                <span>
                  達成日数{' '}
                  <strong className="font-numeric text-stone-800 dark:text-stone-200">
                    {monthStats.activeDays}日
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  達成ミッション{' '}
                  <strong className="font-numeric text-stone-800 dark:text-stone-200">
                    {monthStats.completedMissions}回
                  </strong>
                </span>
              </div>
            </div>

            {/* Month Controls */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                  <span className="font-numeric">{currentYear}</span>年{' '}
                  <span className="font-numeric">{currentMonth + 1}</span>月
                </h3>
                {!isViewingCurrentMonth && (
                  <button
                    type="button"
                    onClick={handleJumpToday}
                    className="min-h-[36px] rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-bold text-stone-700 transition-colors hover:bg-stone-100 active:scale-95 whitespace-nowrap shrink-0 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
                  >
                    今月へ
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="前の月"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition-colors hover:bg-stone-100 active:scale-95 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="次の月"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition-colors hover:bg-stone-100 active:scale-95 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs dark:border-stone-800 dark:bg-stone-900">
              {/* Weekday Header */}
              <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50/80 dark:border-stone-800 dark:bg-stone-900/90">
                {CALENDAR_CONFIG.weekDays.map((dayLabel, idx) => (
                  <div
                    key={dayLabel}
                    className={`py-2.5 text-center text-xs font-bold ${
                      idx === 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : idx === 6
                          ? 'text-blue-600 dark:text-sky-400'
                          : 'text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {dayLabel}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7">
                {calendarCells.map((cell, index) => {
                  const record = records[cell.dateKey];
                  const amount = record?.totalAmount ?? 0;
                  const hasEarnings = amount > 0;
                  const isRightEdge = (index + 1) % 7 === 0;
                  const cellDelta = feedback?.dateDeltas[cell.dateKey];
                  const cellAnimClass =
                    cellDelta && cellDelta > 0
                      ? 'animate-cell-pop'
                      : cellDelta && cellDelta < 0
                        ? 'animate-cell-drop'
                        : '';

                  const dayNumberColor = !cell.isCurrentMonth
                    ? 'text-stone-300 dark:text-stone-700'
                    : cell.isToday
                      ? 'bg-emerald-600 text-white'
                      : cell.dayOfWeek === 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : cell.dayOfWeek === 6
                          ? 'text-blue-600 dark:text-sky-400'
                          : 'text-stone-800 dark:text-stone-200';

                  return (
                    <button
                      key={`${cell.dateKey}-${cellAnimClass ? feedback?.id : 'idle'}`}
                      type="button"
                      onClick={() => onSelectDate(cell.dateKey)}
                      aria-label={`${formatDisplayDate(cell.dateKey)}${
                        hasEarnings ? ` 合計${formatYen(amount)}` : ' 未登録'
                      }`}
                      className={`group relative flex min-h-[64px] sm:min-h-[88px] flex-col justify-between p-1.5 sm:p-2 text-left transition-colors active:bg-emerald-100/70 dark:active:bg-emerald-950/70 ${cellAnimClass} ${
                        !isRightEdge ? 'border-r border-stone-100 dark:border-stone-800/80' : ''
                      } border-b border-stone-100 dark:border-stone-800/80 ${
                        hasEarnings && cell.isCurrentMonth
                          ? 'bg-emerald-50/60 hover:bg-emerald-50 dark:bg-emerald-950/35 dark:hover:bg-emerald-950/55'
                          : cell.isCurrentMonth
                            ? 'bg-white hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800/70'
                            : 'bg-stone-50/40 hover:bg-stone-100/50 dark:bg-stone-950/40 dark:hover:bg-stone-900/60'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span
                          className={`font-numeric inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-xs sm:text-sm font-bold ${dayNumberColor}`}
                        >
                          {cell.dayNumber}
                        </span>
                        {hasEarnings && (
                          <CheckCircle2
                            className={`hidden sm:block h-3.5 w-3.5 shrink-0 ${
                              cell.isCurrentMonth
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-emerald-400 dark:text-emerald-700'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <div className="mt-1 w-full">
                        {hasEarnings ? (
                          <p
                            className={`font-numeric truncate text-[11px] sm:text-xs font-bold leading-tight ${
                              cell.isCurrentMonth
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-emerald-600/60 dark:text-emerald-600/70'
                            }`}
                          >
                            {formatYen(amount)}
                          </p>
                        ) : (
                          <span className="block h-3.5" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400">
              日付をタップすると、{activeMember.name}のおこづかい登録画面が開きます。
            </p>
          </section>

          {/* Right Column: Combined Summary & Action Controls */}
          <aside className="lg:col-span-4 space-y-4">
            {/* Desktop Combined Summary Card */}
            <div className="hidden lg:block rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
                      {currentYear}年{currentMonth + 1}月合計
                    </p>
                    {feedback && monthDelta !== 0 && (
                      <span
                        className={`font-numeric text-xs font-bold ${
                          monthDelta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {monthDelta > 0 ? `+${formatYen(monthDelta)}` : `-${formatYen(Math.abs(monthDelta))}`}
                      </span>
                    )}
                  </div>
                  <p className="font-numeric mt-1 text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                    <AnimatedYen
                      value={monthStats.totalAmount}
                      fromValue={previousMonthTotal}
                      triggerKey={feedback?.id}
                      durationMs={520}
                    />
                  </p>
                </div>

                <div className="border-t border-stone-100 pt-3.5 dark:border-stone-800">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
                      総計
                    </p>
                    {feedback && feedback.delta !== 0 && (
                      <span
                        className={`font-numeric text-xs font-bold ${
                          feedback.delta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {feedback.delta > 0
                          ? `+${formatYen(feedback.delta)}`
                          : `-${formatYen(Math.abs(feedback.delta))}`}
                      </span>
                    )}
                  </div>
                  <p
                    className={`font-numeric mt-1 text-2xl font-bold tracking-tight ${
                      balanceSummary.currentBalance < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-stone-900 dark:text-stone-100'
                    }`}
                  >
                    <AnimatedYen
                      value={balanceSummary.currentBalance}
                      fromValue={previousBalance}
                      triggerKey={feedback?.id}
                      durationMs={520}
                    />
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 border-t border-stone-100 pt-3 text-xs text-stone-600 dark:border-stone-800 dark:text-stone-400">
                <span>
                  達成日数{' '}
                  <strong className="font-numeric text-stone-900 dark:text-stone-100">
                    {monthStats.activeDays}日
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  達成数{' '}
                  <strong className="font-numeric text-stone-900 dark:text-stone-100">
                    {monthStats.completedMissions}回
                  </strong>
                </span>
              </div>

              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => onSelectDate(todayKey)}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-500 active:scale-[0.98]"
                >
                  <span>本日分を登録する</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={onOpenBulkRegister}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-bold text-stone-800 transition-colors hover:bg-stone-100 active:scale-[0.98] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
                >
                  <CalendarRange className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>期間一括登録</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenLedger}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 transition-colors hover:bg-stone-50 active:scale-[0.98] dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-900"
                >
                  <SlidersHorizontal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>分析・設定</span>
                </button>
              </div>
            </div>

            {/* Mobile Action Buttons */}
            <div className="space-y-2.5 lg:hidden">
              <button
                type="button"
                onClick={() => onSelectDate(todayKey)}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-emerald-500 active:scale-[0.98]"
              >
                <span>本日分を登録する</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onOpenBulkRegister}
                  className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm font-bold text-stone-800 shadow-xs transition-colors hover:bg-stone-50 active:scale-[0.98] whitespace-nowrap dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
                >
                  <CalendarRange className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>期間一括登録</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenLedger}
                  className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm font-bold text-stone-800 shadow-xs transition-colors hover:bg-stone-50 active:scale-[0.98] whitespace-nowrap dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
                >
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>分析・設定</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Quick Add Member Modal */}
      {showQuickAddMember && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/70 p-4 backdrop-blur-xs sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-add-member-title"
        >
          <form
            onSubmit={handleSubmitQuickAddMember}
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-900"
          >
            <div className="flex items-center justify-between gap-2">
              <h3
                id="quick-add-member-title"
                className="font-display text-base font-bold text-stone-900 dark:text-stone-100"
              >
                対象者を追加
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickAddMember(false)}
                aria-label="閉じる"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label
                  htmlFor="quick-member-name"
                  className="block text-xs font-bold text-stone-600 dark:text-stone-400"
                >
                  なまえ（例: たろう、はなこ、パパ）
                </label>
                <input
                  id="quick-member-name"
                  type="text"
                  maxLength={16}
                  autoFocus
                  placeholder="名前を入力"
                  value={newMemberName}
                  onChange={(e) => {
                    setNewMemberName(e.target.value);
                    setMemberError('');
                  }}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm font-bold text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-stone-600 dark:text-stone-400">
                  アイコン
                </span>
                <div className="mt-1.5 grid grid-cols-6 gap-1.5">
                  {MEMBER_EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewMemberEmoji(emoji)}
                      className={`flex min-h-[40px] items-center justify-center rounded-xl border text-lg transition-colors ${
                        newMemberEmoji === emoji
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/70'
                          : 'border-stone-200 bg-white hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-950 dark:hover:bg-stone-800'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {memberError && (
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  {memberError}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowQuickAddMember(false)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>追加して切替</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
