import test from "node:test";
import assert from "node:assert/strict";

import {
  parsePositiveInteger,
  selectEligibleStores,
  statusSummary,
} from "./sync-verified-stores.mjs";

const registry = [
  { slug: "verified-electronics", name: "Verified Electronics", status: "VERIFIED" },
  { slug: "partial-home", name: "Partial Home", status: "PARTIAL" },
  { slug: "blocked-food", name: "Blocked Food", status: "BLOCKED" },
];

test("selectEligibleStores defaults to verified stores only", () => {
  assert.deepEqual(
    selectEligibleStores(registry).map((store) => store.slug),
    ["verified-electronics"],
  );
});

test("selectEligibleStores supports an explicit status and store subset", () => {
  assert.deepEqual(
    selectEligibleStores(registry, { statuses: ["partial"], slugs: ["partial-home"] }).map((store) => store.slug),
    ["partial-home"],
  );
});

test("selectEligibleStores rejects unsupported statuses", () => {
  assert.throws(
    () => selectEligibleStores(registry, { statuses: ["LIVE"] }),
    /Unsupported registry status: LIVE/,
  );
});

test("statusSummary makes an empty production batch diagnosable", () => {
  assert.deepEqual(statusSummary(registry), { VERIFIED: 1, PARTIAL: 1, BLOCKED: 1 });
});

test("parsePositiveInteger bounds concurrency and catalog limits", () => {
  assert.equal(parsePositiveInteger("4", "concurrency", { maximum: 4 }), 4);
  assert.throws(() => parsePositiveInteger("0", "concurrency", { maximum: 4 }), /between 1 and 4/);
  assert.throws(() => parsePositiveInteger("5", "concurrency", { maximum: 4 }), /between 1 and 4/);
});
