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
  assert.equal(classifyProduct("Матрас пружинный 160x200")[0], "home");
  assert.equal(classifyProduct("ЭКСМО Книга Убийство в Восточном экспрессе")[0], "books-hobby");
  assert.equal(classifyProduct("Набор игрушек для песка 5шт")[0], "kids");
  assert.equal(classifyProduct("Persil Стиральный порошок 8 кг")[0], "home");
  assert.equal(classifyProduct("Rioba Шоколад в плитке 100г")[0], "sweets");
  assert.equal(classifyProduct("Joanna Краска для волос")[0], "beauty");
  assert.equal(classifyProduct("SIGMA Ламинатор A4")[0], "electronics");
  assert.equal(classifyProduct("Metro Chef Маскарпоне 500г")[0], "dairy");
  assert.equal(classifyProduct("Свиной балык Rogob, кг")[0], "meat-fish");
  assert.equal(classifyProduct("Семена чиа 150г")[0], "groceries");
  assert.equal(classifyProduct("Торт Сметанный 1кг")[0], "sweets");
  assert.equal(classifyProduct("Майонез на перепелиных яйцах")[0], "groceries");
  assert.equal(classifyProduct("Средство для удаления накипи c чайников")[0], "home");
  assert.equal(classifyProduct("Минеральная вода со вкусом яблока")[0], "drinks");
  assert.equal(classifyProduct("Тетрадь А5 12 листов")[0], "books-hobby");
  assert.equal(classifyProduct("Капсулы для стирки 48 шт")[0], "home");
  assert.equal(classifyProduct("Бальзам после бритья 100мл")[0], "beauty");
  assert.equal(classifyProduct("Батарейки AAA 12 шт")[0], "electronics");
  assert.equal(classifyProduct("Школьный рюкзак")[0], "fashion");
  assert.equal(classifyProduct("Тарелка десертная 20см")[0], "home");
  assert.equal(classifyProduct("INTEX Бассейн надувной 183см")[0], "kids");
  assert.equal(classifyProduct("Кофе молотый 250 г")[0], "drinks");
  assert.equal(classifyProduct("Вино красное сухое 0.75 л")[0], "alcohol");
  assert.equal(classifyProduct("Сыр голландский 200 г")[0], "dairy");
  assert.equal(classifyProduct("Яблоки Голден кг")[0], "produce");
});
