import { APP_CONFIG, CALENDAR_CONFIG, MISSIONS_DATA } from '../data/missions';
import {
  AllowanceAdjustment,
  AllowanceStore,
  DailyAllowanceRecord,
  MissionDefinition,
  MissionEntryState,
} from '../types/allowance';

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = CALENDAR_CONFIG.weekDays[date.getDay()];
  return `${month}月${day}日 (${weekday})`;
}

export function formatFullDisplayDate(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = CALENDAR_CONFIG.weekDays[date.getDay()];
  return `${year}年${month}月${day}日 (${weekday})`;
}

export function enumerateDateKeys(startDateKey: string, endDateKey: string): string[] {
  if (!startDateKey || !endDateKey || startDateKey > endDateKey) {
    return [];
  }
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const maxDays = 366;

  while (cursor <= end && keys.length < maxDays) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

export function formatYen(amount: number): string {
  return `${amount.toLocaleString('ja-JP')}${APP_CONFIG.currencyUnit}`;
}

export function calculateTotalFromItems(
  items: Record<string, MissionEntryState>,
  missions: MissionDefinition[] = MISSIONS_DATA
): number {
  const missionMap = new Map(missions.map((m) => [m.id, m]));
  return Object.entries(items).reduce((sum, [missionId, entry]) => {
    if (!entry || !entry.completed) return sum;
    const mission = missionMap.get(missionId);
    const unitAmount = entry.amountSnapshot ?? mission?.amount ?? 0;
    return sum + unitAmount * Math.max(1, entry.multiplier);
  }, 0);
}

export function createInitialItemsState(
  existingRecord: DailyAllowanceRecord | undefined,
  missions: MissionDefinition[] = MISSIONS_DATA
): Record<string, MissionEntryState> {
  const initial: Record<string, MissionEntryState> = {};
  for (const mission of missions) {
    const saved = existingRecord?.items?.[mission.id];
    initial[mission.id] = saved
      ? {
          completed: Boolean(saved.completed),
          multiplier: Math.max(1, Math.min(APP_CONFIG.maxMultiplier, Number(saved.multiplier) || 1)),
          titleSnapshot: saved.titleSnapshot ?? mission.title,
          amountSnapshot: saved.amountSnapshot ?? mission.amount,
        }
      : {
          completed: false,
          multiplier: 1,
          titleSnapshot: mission.title,
          amountSnapshot: mission.amount,
        };
  }
  return initial;
}

export function loadAllowanceStore(): AllowanceStore {
  try {
    const raw = window.localStorage.getItem(APP_CONFIG.storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as AllowanceStore;
  } catch {
    return {};
  }
}

export function saveAllowanceStore(store: AllowanceStore): void {
  try {
    window.localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(store));
  } catch {
    // localStorage quota exceeded or unavailable
  }
}

export function loadMissions(): MissionDefinition[] {
  try {
    const raw = window.localStorage.getItem(APP_CONFIG.missionsStorageKey);
    if (!raw) return MISSIONS_DATA;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return MISSIONS_DATA;
    return parsed as MissionDefinition[];
  } catch {
    return MISSIONS_DATA;
  }
}

export function saveMissions(missions: MissionDefinition[]): void {
  try {
    window.localStorage.setItem(APP_CONFIG.missionsStorageKey, JSON.stringify(missions));
  } catch {
    // ignore storage failure
  }
}

export function loadAdjustments(): AllowanceAdjustment[] {
  try {
    const raw = window.localStorage.getItem(APP_CONFIG.adjustmentsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AllowanceAdjustment[];
  } catch {
    return [];
  }
}

export function saveAdjustments(adjustments: AllowanceAdjustment[]): void {
  try {
    window.localStorage.setItem(APP_CONFIG.adjustmentsStorageKey, JSON.stringify(adjustments));
  } catch {
    // ignore storage failure
  }
}

export function calculateBalanceSummary(
  records: AllowanceStore,
  adjustments: AllowanceAdjustment[]
): {
  missionTotal: number;
  adjustmentNet: number;
  currentBalance: number;
} {
  const missionTotal = Object.values(records).reduce((sum, rec) => sum + (rec.totalAmount || 0), 0);
  const adjustmentNet = adjustments.reduce(
    (sum, adj) => sum + (adj.type === 'add' ? adj.amount : -adj.amount),
    0
  );
  return {
    missionTotal,
    adjustmentNet,
    currentBalance: missionTotal + adjustmentNet,
  };
}

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildAllowanceCsvContent(
  records: AllowanceStore,
  adjustments: AllowanceAdjustment[],
  missions: MissionDefinition[]
): string {
  const missionMap = new Map(missions.map((m) => [m.id, m]));
  const rows: string[][] = [
    ['日付', '区分', '項目名', '単価(円)', '倍率', '金額(円)', 'メモ'],
  ];

  const sortedRecords = Object.values(records).sort((a, b) =>
    a.dateKey < b.dateKey ? 1 : -1
  );

  for (const record of sortedRecords) {
    for (const [missionId, entry] of Object.entries(record.items)) {
      if (!entry.completed) continue;
      const mission = missionMap.get(missionId);
      const title = entry.titleSnapshot ?? mission?.title ?? missionId;
      const unitAmount = entry.amountSnapshot ?? mission?.amount ?? 0;
      const multiplier = Math.max(1, entry.multiplier);
      const subtotal = unitAmount * multiplier;
      rows.push([
        record.dateKey,
        'ミッション達成',
        title,
        String(unitAmount),
        `x${multiplier}`,
        String(subtotal),
        '',
      ]);
    }
  }

  const sortedAdjustments = [...adjustments].sort((a, b) =>
    a.dateKey < b.dateKey ? 1 : -1
  );

  for (const adj of sortedAdjustments) {
    const signedAmount = adj.type === 'add' ? adj.amount : -adj.amount;
    rows.push([
      adj.dateKey,
      adj.type === 'add' ? '手動追加' : '手動減少',
      adj.memo || (adj.type === 'add' ? 'おこづかい追加' : 'おこづかい利用'),
      String(signedAmount),
      'x1',
      String(signedAmount),
      adj.memo,
    ]);
  }

  // Sort all data rows (excluding header) by date desc
  const header = rows[0];
  const dataRows = rows.slice(1).sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));

  return (
    '\uFEFF' +
    [header, ...dataRows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n')
  );
}

export function downloadAllowanceCsv(
  records: AllowanceStore,
  adjustments: AllowanceAdjustment[],
  missions: MissionDefinition[]
): void {
  const csv = buildAllowanceCsvContent(records, adjustments, missions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const todayStr = formatDateKey(new Date());
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `okozukai_records_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface CalendarCell {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: number; // 0 = Sun, 6 = Sat
}

export function buildCalendarGrid(year: number, monthIndex: number): CalendarCell[] {
  const todayKey = formatDateKey(new Date());
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const date = new Date(year, monthIndex - 1, dayNum);
    cells.push({
      date,
      dateKey: formatDateKey(date),
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: formatDateKey(date) === todayKey,
      dayOfWeek: date.getDay(),
    });
  }

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date = new Date(year, monthIndex, dayNum);
    const dateKey = formatDateKey(date);
    cells.push({
      date,
      dateKey,
      dayNumber: dayNum,
      isCurrentMonth: true,
      isToday: dateKey === todayKey,
      dayOfWeek: date.getDay(),
    });
  }

  const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let dayNum = 1; dayNum <= remaining; dayNum++) {
    const date = new Date(year, monthIndex + 1, dayNum);
    cells.push({
      date,
      dateKey: formatDateKey(date),
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: formatDateKey(date) === todayKey,
      dayOfWeek: date.getDay(),
    });
  }

  return cells;
}
