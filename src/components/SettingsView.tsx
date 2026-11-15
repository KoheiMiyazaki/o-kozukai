import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Download,
  Minus,
  Pencil,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORY_OPTIONS, EMOJI_OPTIONS } from '../data/missions';
import {
  AdjustmentType,
  AllowanceAdjustment,
  AllowanceStore,
  MissionCategory,
  MissionDefinition,
} from '../types/allowance';
import {
  downloadAllowanceCsv,
  formatDateKey,
  formatFullDisplayDate,
  formatYen,
} from '../utils/storage';

interface SettingsViewProps {
  missions: MissionDefinition[];
  records: AllowanceStore;
  adjustments: AllowanceAdjustment[];
  onAddMission: (mission: Omit<MissionDefinition, 'id' | 'imagePath'>) => void;
  onUpdateMission: (mission: MissionDefinition) => void;
  onDeleteMission: (missionId: string) => void;
  onAddAdjustment: (adjustment: Omit<AllowanceAdjustment, 'id' | 'createdAt'>) => void;
  onDeleteAdjustment: (adjustmentId: string) => void;
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  missions,
  records,
  adjustments,
  onAddMission,
  onUpdateMission,
  onDeleteMission,
  onAddAdjustment,
  onDeleteAdjustment,
  onBack,
}) => {
  // --- ミッション追加・編集フォーム状態 ---
  const [isAddingMission, setIsAddingMission] = useState(false);
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [confirmDeleteMissionId, setConfirmDeleteMissionId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('100');
  const [formUnitLabel, setFormUnitLabel] = useState('1回あたり');
  const [formCategory, setFormCategory] = useState<MissionCategory>('おてつだい');
  const [formEmoji, setFormEmoji] = useState('✨');
  const [missionError, setMissionError] = useState('');

  // --- 任意金額の追加・減少フォーム状態 ---
  const [adjType, setAdjType] = useState<AdjustmentType>('add');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjMemo, setAdjMemo] = useState('');
  const [adjDateKey, setAdjDateKey] = useState(() => formatDateKey(new Date()));
  const [adjMessage, setAdjMessage] = useState('');

  // --- CSVフィードバック ---
  const [csvDownloaded, setCsvDownloaded] = useState(false);

  const openAddForm = () => {
    setEditingMissionId(null);
    setConfirmDeleteMissionId(null);
    setFormTitle('');
    setFormAmount('100');
    setFormUnitLabel('1回あたり');
    setFormCategory('おてつだい');
    setFormEmoji('✨');
    setMissionError('');
    setIsAddingMission(true);
  };

  const openEditForm = (mission: MissionDefinition) => {
    setIsAddingMission(false);
    setConfirmDeleteMissionId(null);
    setEditingMissionId(mission.id);
    setFormTitle(mission.title);
    setFormAmount(String(mission.amount));
    setFormUnitLabel(mission.unitLabel);
    setFormCategory(mission.category);
    setFormEmoji(mission.emoji);
    setMissionError('');
  };

  const closeMissionForm = () => {
    setIsAddingMission(false);
    setEditingMissionId(null);
    setMissionError('');
  };

  const handleSaveMission = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = formTitle.trim();
    const parsedAmount = Number(formAmount);

    if (!trimmedTitle) {
      setMissionError('項目名を入力してください');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setMissionError('金額は1円以上の数字で入力してください');
      return;
    }

    const catOption =
      CATEGORY_OPTIONS.find((c) => c.value === formCategory) ?? CATEGORY_OPTIONS[0];

    if (editingMissionId) {
      const target = missions.find((m) => m.id === editingMissionId);
      if (target) {
        onUpdateMission({
          ...target,
          title: trimmedTitle,
          amount: Math.round(parsedAmount),
          unitLabel: formUnitLabel.trim() || '1回あたり',
          category: formCategory,
          emoji: formEmoji,
          accentBgClass: catOption.accentBgClass,
        });
      }
      setEditingMissionId(null);
    } else {
      onAddMission({
        title: trimmedTitle,
        amount: Math.round(parsedAmount),
        unitLabel: formUnitLabel.trim() || '1回あたり',
        category: formCategory,
        emoji: formEmoji,
        accentBgClass: catOption.accentBgClass,
      });
      setIsAddingMission(false);
    }
    setMissionError('');
  };

  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(adjAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setAdjMessage('1円以上の金額を入力してください');
      return;
    }

    onAddAdjustment({
      dateKey: adjDateKey || formatDateKey(new Date()),
      type: adjType,
      amount: Math.round(parsed),
      memo: adjMemo.trim() || (adjType === 'add' ? 'おこづかい追加' : 'おこづかい利用'),
    });

    setAdjAmount('');
    setAdjMemo('');
    setAdjMessage(
      adjType === 'add'
        ? `${formatYen(Math.round(parsed))} を追加しました`
        : `${formatYen(Math.round(parsed))} を減らしました`
    );
    window.setTimeout(() => setAdjMessage(''), 3000);
  };

  const handleDownloadCsv = () => {
    downloadAllowanceCsv(records, adjustments, missions);
    setCsvDownloaded(true);
    window.setTimeout(() => setCsvDownloaded(false), 3000);
  };

  const totalRecordDays = Object.keys(records).length;

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#FAF9F6]/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"
              aria-hidden="true"
            >
              <Settings className="h-4 w-4" />
            </span>
            <h1 className="font-display text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
              設定・データ管理
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-28 sm:px-6 sm:pt-6 space-y-6">
        {/* Section 1: 任意金額の追加・減少 */}
        <section
          aria-label="任意の金額でおこづかいを追加・減少"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900"
        >
          <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
            おこづかいの追加・減少
          </h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            臨時のおこづかいや、お買い物で使った分を任意の金額で記録できます。
          </p>

          <form onSubmit={handleSubmitAdjustment} className="mt-4 space-y-3.5">
            {/* Segmented Control */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
              <button
                type="button"
                onClick={() => setAdjType('add')}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors ${
                  adjType === 'add'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white'
                }`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>増やす（追加）</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjType('subtract')}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition-colors ${
                  adjType === 'subtract'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white'
                }`}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
                <span>減らす（つかう）</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="adj-amount"
                  className="block text-xs font-bold text-stone-600 dark:text-stone-400"
                >
                  金額（円）
                </label>
                <input
                  id="adj-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="例: 500"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  className="font-numeric mt-1 min-h-[44px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-base font-bold text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                />
              </div>

              <div>
                <label
                  htmlFor="adj-date"
                  className="block text-xs font-bold text-stone-600 dark:text-stone-400"
                >
                  日付
                </label>
                <input
                  id="adj-date"
                  type="date"
                  value={adjDateKey}
                  onChange={(e) => setAdjDateKey(e.target.value)}
                  className="font-numeric mt-1 min-h-[44px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm font-medium text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="adj-memo"
                className="block text-xs font-bold text-stone-600 dark:text-stone-400"
              >
                メモ（理由）
              </label>
              <input
                id="adj-memo"
                type="text"
                maxLength={40}
                placeholder={adjType === 'add' ? '例: お年玉、お手伝いボーナス' : '例: おかし、ガチャガチャ'}
                value={adjMemo}
                onChange={(e) => setAdjMemo(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </div>

            {adjMessage && (
              <p
                role="status"
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400"
              >
                {adjMessage}
              </p>
            )}

            <button
              type="submit"
              className={`flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-sm font-bold text-white transition-colors active:scale-[0.99] ${
                adjType === 'add'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              {adjType === 'add' ? '金額を追加する' : '金額を減らす'}
            </button>
          </form>

          {/* Recent Adjustments */}
          {adjustments.length > 0 && (
            <div className="mt-5 border-t border-stone-100 pt-4 dark:border-stone-800">
              <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
                履歴（最新{Math.min(5, adjustments.length)}件）
              </p>
              <div className="mt-2 divide-y divide-stone-100 dark:divide-stone-800">
                {[...adjustments]
                  .sort((a, b) => (a.dateKey !== b.dateKey ? (a.dateKey < b.dateKey ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1))
                  .slice(0, 5)
                  .map((adj) => (
                  <div
                    key={adj.id}
                    className="flex min-h-[48px] items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-stone-800 dark:text-stone-200">
                        {adj.memo}
                      </p>
                      <p className="font-numeric text-xs text-stone-500 dark:text-stone-400">
                        {formatFullDisplayDate(adj.dateKey)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`font-numeric text-sm font-bold ${
                          adj.type === 'add'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {adj.type === 'add' ? `+${formatYen(adj.amount)}` : `-${formatYen(adj.amount)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteAdjustment(adj.id)}
                        aria-label={`${adj.memo}の記録を削除`}
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-rose-600 dark:hover:bg-stone-800 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Section 2: おこづかい項目の追加・編集・削除 */}
        <section
          aria-label="おこづかい項目の管理"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                おこづかい項目の編集
              </h2>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                ミッションの追加・金額変更・削除ができます。
              </p>
            </div>
            {!isAddingMission && !editingMissionId && (
              <button
                type="button"
                onClick={openAddForm}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 active:scale-95 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>項目を追加</span>
              </button>
            )}
          </div>

          {/* Add / Edit Mission Form */}
          {(isAddingMission || editingMissionId) && (
            <form
              onSubmit={handleSaveMission}
              className="mt-4 space-y-3.5 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-950"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  {editingMissionId ? '項目を編集' : '新しい項目を追加'}
                </h3>
                <button
                  type="button"
                  onClick={closeMissionForm}
                  aria-label="フォームを閉じる"
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label
                  htmlFor="mission-title"
                  className="block text-xs font-bold text-stone-600 dark:text-stone-400"
                >
                  項目名
                </label>
                <input
                  id="mission-title"
                  type="text"
                  maxLength={30}
                  placeholder="例: ピアノのれんしゅう"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm font-medium text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="mission-amount"
                    className="block text-xs font-bold text-stone-600 dark:text-stone-400"
                  >
                    金額（円）
                  </label>
                  <input
                    id="mission-amount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="font-numeric mt-1 min-h-[44px] w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm font-bold text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="mission-unit"
                    className="block text-xs font-bold text-stone-600 dark:text-stone-400"
                  >
                    単位
                  </label>
                  <input
                    id="mission-unit"
                    type="text"
                    maxLength={16}
                    placeholder="1回あたり"
                    value={formUnitLabel}
                    onChange={(e) => setFormUnitLabel(e.target.value)}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-stone-600 dark:text-stone-400">
                  カテゴリ
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormCategory(cat.value)}
                      className={`min-h-[40px] rounded-xl border text-xs font-bold transition-colors ${
                        formCategory === cat.value
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800'
                      }`}
                    >
                      {cat.value}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-stone-600 dark:text-stone-400">
                  アイコン
                </span>
                <div className="mt-1.5 grid grid-cols-8 gap-1.5">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormEmoji(emoji)}
                      className={`flex min-h-[40px] items-center justify-center rounded-xl border text-lg transition-colors ${
                        formEmoji === emoji
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/70'
                          : 'border-stone-200 bg-white hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {missionError && (
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  {missionError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeMissionForm}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span>{editingMissionId ? '更新する' : '追加する'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Mission List */}
          <div className="mt-4 divide-y divide-stone-100 dark:divide-stone-800">
            {missions.map((mission) => {
              const isConfirmingDelete = confirmDeleteMissionId === mission.id;

              return (
                <div
                  key={mission.id}
                  className="flex min-h-[60px] items-center justify-between gap-2.5 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${mission.accentBgClass}`}
                      aria-hidden="true"
                    >
                      {mission.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">
                        {mission.title}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        <span className="font-numeric font-bold text-stone-700 dark:text-stone-300">
                          {formatYen(mission.amount)}
                        </span>{' '}
                        · {mission.unitLabel} · {mission.category}
                      </p>
                    </div>
                  </div>

                  {isConfirmingDelete ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteMission(mission.id);
                          setConfirmDeleteMissionId(null);
                        }}
                        className="min-h-[40px] rounded-xl bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-500"
                      >
                        削除する
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMissionId(null)}
                        className="min-h-[40px] rounded-xl border border-stone-200 px-2.5 text-xs font-bold text-stone-600 dark:border-stone-700 dark:text-stone-300"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(mission)}
                        aria-label={`${mission.title}を編集`}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMissionId(mission.id)}
                        disabled={missions.length <= 1}
                        aria-label={`${mission.title}を削除`}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-stone-100 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-stone-800 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 3: CSV ダウンロード */}
        <section
          aria-label="記録データのCSVダウンロード"
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900"
        >
          <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
            記録データのダウンロード
          </h2>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            これまでのミッション達成記録と手動調整（登録日数{' '}
            <span className="font-numeric font-bold text-stone-700 dark:text-stone-300">
              {totalRecordDays}日
            </span>
            ・調整{' '}
            <span className="font-numeric font-bold text-stone-700 dark:text-stone-300">
              {adjustments.length}件
            </span>
            ）をCSV形式で保存できます。
          </p>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-bold text-stone-900 transition-colors hover:bg-stone-100 active:scale-[0.99] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
          >
            <Download className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>CSV形式でダウンロード</span>
          </button>

          {csvDownloaded && (
            <p
              role="status"
              className="mt-2.5 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400"
            >
              CSVファイルをダウンロードしました
            </p>
          )}
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
