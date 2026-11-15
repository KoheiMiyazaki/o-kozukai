import { MissionCategory, MissionDefinition } from '../types/allowance';

/**
 * アプリ全体の基本設定・ラベル定義（疎結合データ）
 * テキストや単位を変更するだけで別用途の記録アプリに転用可能
 */
export const APP_CONFIG = {
  appName: 'おこづかい管理くん',
  shortName: 'おこづかい',
  currencyUnit: '円',
  storageKey: 'okozukai_kanri_records_v1',
  missionsStorageKey: 'okozukai_kanri_missions_v1',
  adjustmentsStorageKey: 'okozukai_kanri_adjustments_v1',
  themeStorageKey: 'okozukai_kanri_theme_v1',
  maxMultiplier: 99,
} as const;

export const CALENDAR_CONFIG = {
  weekDays: ['日', '月', '火', '水', '木', '金', '土'] as const,
} as const;

export const CATEGORY_OPTIONS: Array<{ value: MissionCategory; accentBgClass: string }> = [
  {
    value: 'おてつだい',
    accentBgClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
  },
  {
    value: 'べんきょう',
    accentBgClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300',
  },
  {
    value: 'せいかつ',
    accentBgClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
  },
];

export const EMOJI_OPTIONS: string[] = [
  '👕',
  '🍽️',
  '🛁',
  '🗑️',
  '✏️',
  '📖',
  '👟',
  '🧸',
  '🧹',
  '🌱',
  '🐶',
  '🛒',
  '🎹',
  '⚽',
  '✨',
  '🍚',
];

export const ANALYTICS_CHART_COLORS: string[] = [
  '#10b981', // emerald
  '#38bdf8', // sky
  '#f59e0b', // amber
  '#a78bfa', // violet
  '#fb7185', // rose
  '#2dd4bf', // teal
  '#818cf8', // indigo
  '#fb923c', // orange
  '#a3e635', // lime
  '#f472b6', // pink
];

/**
 * 事前登録ミッション（おこづかい項目）初期一覧データ
 * 中身を書き換えるだけで項目・金額・表示アイコンを自在に変更可能
 */
export const MISSIONS_DATA: MissionDefinition[] = [
  {
    id: 'laundry',
    title: 'せんたくものたたみ',
    amount: 100,
    unitLabel: '1回あたり',
    category: 'おてつだい',
    emoji: '👕',
    accentBgClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300',
    /* TODO: 画像差し替え用パス (例: './assets/mission_laundry.png') */
    imagePath: '',
  },
  {
    id: 'dishes',
    title: 'おさらあらい',
    amount: 150,
    unitLabel: '1回あたり',
    category: 'おてつだい',
    emoji: '🍽️',
    accentBgClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
    /* TODO: 画像差し替え用パス (例: './assets/mission_dishes.png') */
    imagePath: '',
  },
  {
    id: 'bath',
    title: 'おふろそうじ',
    amount: 200,
    unitLabel: '1回あたり',
    category: 'おてつだい',
    emoji: '🛁',
    accentBgClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300',
    /* TODO: 画像差し替え用パス (例: './assets/mission_bath.png') */
    imagePath: '',
  },
  {
    id: 'trash',
    title: 'ゴミだし',
    amount: 100,
    unitLabel: '1ふくろ',
    category: 'おてつだい',
    emoji: '🗑️',
    accentBgClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
    /* TODO: 画像差し替え用パス (例: './assets/mission_trash.png') */
    imagePath: '',
  },
  {
    id: 'homework',
    title: 'しゅくだい',
    amount: 100,
    unitLabel: '1ページ・1科目',
    category: 'べんきょう',
    emoji: '✏️',
    accentBgClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300',
    /* TODO: 画像差し替え用パス (例: './assets/mission_homework.png') */
    imagePath: '',
  },
  {
    id: 'reading',
    title: 'おんどく・どくしょ',
    amount: 100,
    unitLabel: '1さつ・1回',
    category: 'べんきょう',
    emoji: '📖',
    accentBgClass: 'bg-violet-50 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300',
    /* TODO: 画像差し替え用パス (例: './assets/mission_reading.png') */
    imagePath: '',
  },
  {
    id: 'shoes',
    title: 'くつならべ',
    amount: 50,
    unitLabel: '1回あたり',
    category: 'せいかつ',
    emoji: '👟',
    accentBgClass: 'bg-orange-50 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300',
    /* TODO: 画像差し替え用パス (例: './assets/mission_shoes.png') */
    imagePath: '',
  },
  {
    id: 'tidy',
    title: 'おかたづけ',
    amount: 100,
    unitLabel: '1か所',
    category: 'せいかつ',
    emoji: '🧸',
    accentBgClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300',
    /* TODO: 画像差し替え用パス (例: './assets/mission_tidy.png') */
    imagePath: '',
  },
];
