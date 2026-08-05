/** Milliseconds in one second. */
export const SECONDS = 1000;
/** Milliseconds in one minute. */
export const MINUTES = 60 * SECONDS;
/** Milliseconds in one hour. */
export const HOURS = 60 * MINUTES;
/** Milliseconds in one day. */
export const DAYS = 24 * HOURS;

const MIN_EPOCH_DAY = -2_147_483_648;
const MAX_EPOCH_DAY = 2_147_483_647;

function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

function assertEpochDay(value: number): void {
  if (!Number.isInteger(value) || value < MIN_EPOCH_DAY || value > MAX_EPOCH_DAY) {
    throw new RangeError("Epoch day must be a signed 32-bit integer");
  }
}

function daysFromCivil(year: number, month: number, day: number): number {
  year -= month <= 2 ? 1 : 0;
  const era = floorDiv(year, 400);
  const yearOfEra = year - era * 400;
  const monthIndex = month + (month > 2 ? -3 : 9);
  const dayOfYear = floorDiv(153 * monthIndex + 2, 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + floorDiv(yearOfEra, 4) - floorDiv(yearOfEra, 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

function civilFromDays(epochDay: number): { year: number; month: number; day: number } {
  const shifted = epochDay + 719_468;
  const era = floorDiv(shifted, 146_097);
  const dayOfEra = shifted - era * 146_097;
  const yearOfEra = floorDiv(
    dayOfEra - floorDiv(dayOfEra, 1_460) + floorDiv(dayOfEra, 36_524) - floorDiv(dayOfEra, 146_096),
    365,
  );
  let year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + floorDiv(yearOfEra, 4) - floorDiv(yearOfEra, 100));
  const monthIndex = floorDiv(5 * dayOfYear + 2, 153);
  const day = dayOfYear - floorDiv(153 * monthIndex + 2, 5) + 1;
  const month = monthIndex + (monthIndex < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return { year, month, day };
}

/** Parse an ISO calendar date without involving the host timezone. */
export function isoDateToEpochDay(value: string): number {
  const match = /^([+-]\d{6,}|\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError("Plain date must use YYYY-MM-DD ISO format");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isSafeInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new RangeError("Invalid plain date");
  }
  const epochDay = daysFromCivil(year, month, day);
  const civil = civilFromDays(epochDay);
  if (civil.year !== year || civil.month !== month || civil.day !== day) {
    throw new RangeError("Invalid plain date");
  }
  assertEpochDay(epochDay);
  return epochDay;
}

/** Format a signed 32-bit epoch day as an ISO calendar date. */
export function epochDayToIsoDate(epochDay: number): string {
  assertEpochDay(epochDay);
  const { year, month, day } = civilFromDays(epochDay);
  const yearString =
    year >= 0 && year <= 9_999
      ? String(year).padStart(4, "0")
      : `${year < 0 ? "-" : "+"}${String(Math.abs(year)).padStart(6, "0")}`;
  return `${yearString}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Convert an epoch day to the corresponding UTC-midnight millisecond timestamp. */
export function epochDayToMilliseconds(epochDay: number): number {
  assertEpochDay(epochDay);
  return epochDay * DAYS;
}

/** Convert a timestamp to its containing UTC epoch day. */
export function millisecondsToEpochDay(milliseconds: number): number {
  if (!Number.isFinite(milliseconds)) throw new RangeError("Timestamp must be finite");
  const epochDay = Math.floor(milliseconds / DAYS);
  assertEpochDay(epochDay);
  return epochDay;
}

/** Normalize a persisted/filter plain-date operand to epoch-day units. */
export function toEpochDay(value: unknown): number {
  if (typeof value === "string") return isoDateToEpochDay(value);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError("Plain date must be an ISO date, epoch day, or timestamp");
  }
  if (Number.isInteger(value) && value >= MIN_EPOCH_DAY && value <= MAX_EPOCH_DAY) return value;
  return millisecondsToEpochDay(value);
}
