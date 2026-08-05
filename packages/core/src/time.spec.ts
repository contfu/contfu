import { describe, expect, it } from "bun:test";
import {
  DAYS,
  epochDayToIsoDate,
  epochDayToMilliseconds,
  isoDateToEpochDay,
  millisecondsToEpochDay,
  toEpochDay,
} from "./time";

describe("plain-date conversions", () => {
  it.each([
    ["1970-01-01", 0],
    ["1969-12-31", -1],
    ["2000-02-29", 11_016],
    ["2026-07-01", 20_635],
  ] as const)("round-trips %s", (iso, day) => {
    expect(isoDateToEpochDay(iso)).toBe(day);
    expect(epochDayToIsoDate(day)).toBe(iso);
  });

  it("converts UTC milliseconds using floor semantics before the epoch", () => {
    expect(epochDayToMilliseconds(-1)).toBe(-DAYS);
    expect(millisecondsToEpochDay(-1)).toBe(-1);
    expect(millisecondsToEpochDay(Date.UTC(2026, 6, 1, 23, 59))).toBe(20_635);
  });

  it("keeps epoch-day integers and converts millisecond operands", () => {
    expect(toEpochDay(20_635)).toBe(20_635);
    expect(toEpochDay(Date.UTC(2026, 6, 1))).toBe(20_635);
    expect(toEpochDay("2026-07-01")).toBe(20_635);
  });

  it.each(["2026-02-29", "2026-7-01", "not-a-date"])("rejects invalid input %s", (value) => {
    expect(() => isoDateToEpochDay(value)).toThrow();
  });

  it("supports the signed 32-bit storage boundaries", () => {
    for (const value of [-2_147_483_648, 2_147_483_647]) {
      expect(isoDateToEpochDay(epochDayToIsoDate(value))).toBe(value);
    }
    expect(() => epochDayToIsoDate(2_147_483_648)).toThrow();
  });
});
