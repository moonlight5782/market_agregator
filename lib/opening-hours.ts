import type { Locale } from "./i18n";

export const OPENING_HOURS_TIMEZONE = "Europe/Chisinau";

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type OpeningPeriod = {
  open: string;
  close: string;
};

export type OpeningHours = {
  version: 1;
  kind?: "schedule";
  timezone?: string;
  weekly: Partial<Record<Weekday, OpeningPeriod[]>>;
  temporarilyClosed?: boolean;
  source?: {
    url?: string;
    checkedAt?: string;
  };
};

export type OnlineOnlyHours = {
  version: 1;
  kind: "online_only";
  source?: {
    url?: string;
    checkedAt?: string;
  };
};

export type StoreHours = OpeningHours | OnlineOnlyHours;
export type StoreOpenState = "open" | "closed" | "unknown" | "online_only" | "temporarily_closed";

export type StoreHoursStatus = {
  state: StoreOpenState;
  today: string | null;
};

const weekdayFromIntl: Record<string, Weekday> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

function parseTime(value: string, allowEndOfDay = false) {
  if (allowEndOfDay && value === "24:00") return 24 * 60;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function validPeriod(value: unknown): value is OpeningPeriod {
  if (!value || typeof value !== "object") return false;
  const period = value as OpeningPeriod;
  return parseTime(period.open) != null && parseTime(period.close, true) != null;
}

export function isStoreHours(value: unknown): value is StoreHours {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) return false;
  if (candidate.kind === "online_only") return true;
  if (candidate.kind != null && candidate.kind !== "schedule") return false;
  if (!candidate.weekly || typeof candidate.weekly !== "object") return false;
  const weekly = candidate.weekly as Record<string, unknown>;
  return WEEKDAYS.every((day) => weekly[day] == null || (Array.isArray(weekly[day]) && weekly[day].every(validPeriod)));
}

function localClock(now: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
    const day = weekdayFromIntl[part("weekday") ?? ""];
    const hour = Number(part("hour"));
    const minute = Number(part("minute"));
    if (!day || !Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    return { day, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

function periodContains(period: OpeningPeriod, minutes: number, carryOver: boolean) {
  const open = parseTime(period.open);
  const close = parseTime(period.close, true);
  if (open == null || close == null) return false;
  if (open === close) return open === 0;
  if (close > open) return !carryOver && minutes >= open && minutes < close;
  return carryOver ? minutes < close : minutes >= open;
}

export function formatOpeningPeriods(periods: OpeningPeriod[], locale: Locale) {
  if (periods.length === 0) return locale === "ro" ? "închis" : "выходной";
  if (periods.some((period) => period.open === period.close && period.open === "00:00")) return "24/7";
  return periods.map((period) => `${period.open}–${period.close}`).join(", ");
}

export function getStoreHoursStatus(value: unknown, now = new Date(), locale: Locale = "ru"): StoreHoursStatus {
  if (!isStoreHours(value)) return { state: "unknown", today: null };
  if (value.kind === "online_only") return { state: "online_only", today: null };
  if (value.temporarilyClosed) return { state: "temporarily_closed", today: null };

  const clock = localClock(now, value.timezone || OPENING_HOURS_TIMEZONE);
  if (!clock) return { state: "unknown", today: null };
  const todayIndex = WEEKDAYS.indexOf(clock.day);
  const previousDay = WEEKDAYS[(todayIndex + WEEKDAYS.length - 1) % WEEKDAYS.length];
  const todayPeriods = value.weekly[clock.day];
  const previousPeriods = value.weekly[previousDay];
  if (!todayPeriods || !previousPeriods) return { state: "unknown", today: null };

  const openToday = todayPeriods.some((period) => periodContains(period, clock.minutes, false));
  const openFromYesterday = previousPeriods.some((period) => periodContains(period, clock.minutes, true));
  return {
    state: openToday || openFromYesterday ? "open" : "closed",
    today: formatOpeningPeriods(todayPeriods, locale),
  };
}

