export type MissionCategory = 'おてつだい' | 'べんきょう' | 'せいかつ';

export type AppScreen =
  | 'calendar'
  | 'register'
  | 'bulk-register'
  | 'ledger'
  | 'analytics'
  | 'settings';

export type AdjustmentType = 'add' | 'subtract';

export interface AllowanceMember {
  id: string;
  name: string;
  emoji: string;
  createdAt: string;
}

export interface MissionDefinition {
  id: string;
  title: string;
  amount: number;
  unitLabel: string;
  category: MissionCategory;
  /** オンメモリ表現用絵文字（画像ファイル不使用の原則） */
  emoji: string;
  /** オンメモリ背景グラデーション用クラス */
  accentBgClass: string;
  /** TODO: 将来本物の画像に差し替える際のファイルパス（例: './assets/laundry.png'） */
  imagePath: string;
}

/** 全対象者の memberId -> MissionDefinition[] マップ */
export type MultiMemberMissionsStore = Record<string, MissionDefinition[]>;

export interface MissionEntryState {
  completed: boolean;
  multiplier: number;
  /** 項目編集・削除後も過去履歴の項目名・単価を保持するためのスナップショット */
  titleSnapshot?: string;
  amountSnapshot?: number;
}

export interface DailyMissionItemRecord {
  missionId: string;
  title: string;
  unitAmount: number;
  multiplier: number;
  subtotal: number;
}

export interface DailyAllowanceRecord {
  /** IndexedDB 主キー: `${memberId}::${dateKey}` */
  id?: string;
  memberId: string;
  dateKey: string; // YYYY-MM-DD
  items: Record<string, MissionEntryState>;
  totalAmount: number;
  updatedAt: string;
}

/** 1対象者分の dateKey -> DailyAllowanceRecord マップ */
export type AllowanceStore = Record<string, DailyAllowanceRecord>;

/** 全対象者の memberId -> AllowanceStore マップ */
export type MultiMemberAllowanceStore = Record<string, AllowanceStore>;

export interface AllowanceAdjustment {
  id: string;
  memberId: string;
  dateKey: string; // YYYY-MM-DD
  type: AdjustmentType;
  amount: number;
  memo: string;
  createdAt: string;
}

export interface RegistrationFeedback {
  id: number;
  delta: number;
  previousBalance: number;
  nextBalance: number;
  affectedDateKeys: string[];
  dateDeltas: Record<string, number>;
}
