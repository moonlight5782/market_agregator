import assert from "node:assert/strict";
import test from "node:test";
import { getStoreHoursStatus, isStoreHours, type OpeningHours } from "./opening-hours";

const schedule: OpeningHours = {
  version: 1,
  timezone: "Europe/Chisinau",
  weekly: {
    mon: [{ open: "09:00", close: "20:00" }],
    tue: [{ open: "09:00", close: "20:00" }],
    wed: [{ open: "09:00", close: "20:00" }],
    thu: [{ open: "09:00", close: "20:00" }],
    fri: [{ open: "22:00", close: "02:00" }],
    sat: [],
    sun: [],
  },
};

test("uses the store timezone when determining whether a branch is open", () => {
  assert.deepEqual(getStoreHoursStatus(schedule, new Date("2026-08-10T07:00:00Z")), {
    state: "open",
    today: "09:00–20:00",
  });
  assert.equal(getStoreHoursStatus(schedule, new Date("2026-08-10T18:30:00Z")).state, "closed");
});

test("supports opening periods that continue after midnight", () => {
  assert.equal(getStoreHoursStatus(schedule, new Date("2026-08-14T22:30:00Z")).state, "open");
  assert.equal(getStoreHoursStatus(schedule, new Date("2026-08-14T23:30:00Z")).state, "closed");
});

test("does not present incomplete or malformed schedules as authoritative", () => {
  assert.equal(getStoreHoursStatus(null).state, "unknown");
  assert.equal(getStoreHoursStatus({ version: 1, weekly: { mon: [] } }).state, "unknown");
  assert.equal(isStoreHours({ version: 1, weekly: { mon: [{ open: "25:00", close: "26:00" }] } }), false);
});

test("represents online-only and temporary closures explicitly", () => {
  assert.equal(getStoreHoursStatus({ version: 1, kind: "online_only" }).state, "online_only");
  assert.equal(getStoreHoursStatus({ ...schedule, temporarilyClosed: true }).state, "temporarily_closed");
});

