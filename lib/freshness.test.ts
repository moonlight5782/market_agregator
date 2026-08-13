import assert from "node:assert/strict";
import test from "node:test";
import { freshSince, freshnessState, offerMaxAgeHours, reconcileGraceHours, reconciliationCutoff } from "./freshness";

const now = new Date("2026-08-13T12:00:00.000Z");

test("offer freshness accepts bounded configured values and safe fallbacks", () => {
  assert.equal(offerMaxAgeHours(undefined), 48);
  assert.equal(offerMaxAgeHours("invalid"), 48);
  assert.equal(offerMaxAgeHours("0"), 1);
  assert.equal(offerMaxAgeHours("10000"), 336);
  assert.equal(offerMaxAgeHours("12"), 12);
});

test("freshness cutoff includes the exact threshold and excludes older offers", () => {
  const cutoff = freshSince(now, "24");
  assert.equal(cutoff.toISOString(), "2026-08-12T12:00:00.000Z");
  assert.equal(freshnessState(cutoff, now, "24"), "FRESH");
  assert.equal(freshnessState(new Date("2026-08-12T11:59:59.999Z"), now, "24"), "STALE");
  assert.equal(freshnessState(null, now, "24"), "STALE");
});

test("reconciliation grace is non-negative and bounded", () => {
  assert.equal(reconcileGraceHours(undefined), 0);
  assert.equal(reconcileGraceHours("-1"), 0);
  assert.equal(reconcileGraceHours("2"), 2);
  assert.equal(reconciliationCutoff(now, "2").toISOString(), "2026-08-13T10:00:00.000Z");
});
