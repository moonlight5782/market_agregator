export const DEFAULT_OFFER_MAX_AGE_HOURS = 48;
const MIN_OFFER_MAX_AGE_HOURS = 1;
const MAX_OFFER_MAX_AGE_HOURS = 24 * 14;

export type FreshnessState = "FRESH" | "STALE";

export function offerMaxAgeHours(rawValue = process.env.OFFER_MAX_AGE_HOURS): number {
  const parsed = Number(rawValue ?? DEFAULT_OFFER_MAX_AGE_HOURS);
  if (!Number.isFinite(parsed)) return DEFAULT_OFFER_MAX_AGE_HOURS;
  return Math.min(MAX_OFFER_MAX_AGE_HOURS, Math.max(MIN_OFFER_MAX_AGE_HOURS, parsed));
}

export function freshSince(now = new Date(), rawValue = process.env.OFFER_MAX_AGE_HOURS): Date {
  return new Date(now.getTime() - offerMaxAgeHours(rawValue) * 60 * 60 * 1000);
}

export function freshnessState(lastSeenAt: Date | null | undefined, now = new Date(), rawValue = process.env.OFFER_MAX_AGE_HOURS): FreshnessState {
  return lastSeenAt && lastSeenAt >= freshSince(now, rawValue) ? "FRESH" : "STALE";
}

export function reconcileGraceHours(rawValue = process.env.OFFER_RECONCILIATION_GRACE_HOURS): number {
  const parsed = Number(rawValue ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(MAX_OFFER_MAX_AGE_HOURS, parsed);
}

export function reconciliationCutoff(runStartedAt: Date, rawValue = process.env.OFFER_RECONCILIATION_GRACE_HOURS): Date {
  return new Date(runStartedAt.getTime() - reconcileGraceHours(rawValue) * 60 * 60 * 1000);
}
