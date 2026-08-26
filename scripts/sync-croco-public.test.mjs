import assert from "node:assert/strict";
import test from "node:test";
import { classifyProduct, extractJsonArray } from "./sync-croco-public.mjs";

test("extracts the public catalogProducts array without using Croco APIs", () => {
  const html = '<div x-data=\'{"catalogProducts":[{"id":1,"name_ru":"Кофе","coords":"[[1,2],[3,4]]"}],"other":true}\'></div>';
  assert.deepEqual(extractJsonArray(html, "catalogProducts"), [{ id: 1, name_ru: "Кофе", coords: "[[1,2],[3,4]]" }]);
});

test("maps diverse flyer titles to coarse catalog categories", () => {
  assert.equal(classifyProduct("Шампунь для волос 400 мл")[0], "beauty");
  assert.equal(classifyProduct("Гель для стирки 2 л")[0], "home");
  assert.equal(classifyProduct("Кофе молотый 250 г")[0], "groceries");
});
