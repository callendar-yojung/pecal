import { getHolidayNamesE } from "@hyunbinseo/holidays-kr";

export type KoreanSpecialDayType = "holiday" | "anniversary";

export type KoreanSpecialDay = {
  month: number;
  day: number;
  name: string;
  type: KoreanSpecialDayType;
};

const FIXED_KOREAN_ANNIVERSARIES: KoreanSpecialDay[] = [
  { month: 2, day: 14, name: "발렌타인데이", type: "anniversary" },
  { month: 3, day: 14, name: "화이트데이", type: "anniversary" },
  { month: 5, day: 8, name: "어버이날", type: "anniversary" },
  { month: 5, day: 15, name: "스승의날", type: "anniversary" },
  { month: 6, day: 25, name: "6·25", type: "anniversary" },
  { month: 11, day: 11, name: "빼빼로데이", type: "anniversary" },
];

function toMonthDayKey(month: number, day: number): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidDateParts(year: number, month: number, day: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

const ANNIVERSARY_MAP = new Map<string, KoreanSpecialDay[]>();
for (const item of FIXED_KOREAN_ANNIVERSARIES) {
  const key = toMonthDayKey(item.month, item.day);
  const bucket = ANNIVERSARY_MAP.get(key);
  if (bucket) bucket.push(item);
  else ANNIVERSARY_MAP.set(key, [item]);
}

export function getKoreanSpecialDaysForDateParts(
  year: number,
  month: number,
  day: number,
): KoreanSpecialDay[] {
  if (!isValidDateParts(year, month, day)) return [];

  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dateInKST = new Date(`${key}T00:00:00+09:00`);
  const holidays: KoreanSpecialDay[] = [];

  try {
    const holidayNames = getHolidayNamesE(dateInKST);
    if (holidayNames) {
      for (const name of holidayNames) {
        holidays.push({ month, day, name, type: "holiday" });
      }
    }
  } catch {
    // Out of supported range or malformed date. Keep anniversaries-only fallback.
  }

  const anniversaries = ANNIVERSARY_MAP.get(toMonthDayKey(month, day)) ?? [];
  return [...holidays, ...anniversaries];
}

export function getKoreanSpecialDaysForDateKey(dateKey: string): KoreanSpecialDay[] {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return getKoreanSpecialDaysForDateParts(year, month, day);
}
