import assert from "node:assert/strict";
import test from "node:test";
import { extractLinellaCategoryUrls, extractLinellaProducts } from "./sync-linella-public.mjs";

test("extracts direct Linella product links and regular prices", () => {
  const html = `<div class="products-catalog-content__item" data-SKU="2013001">
    <a href="/ru/catalog/drinks/lemonade" class="head-products-catalog-content__image"><img src="/public/products/lemonade.webp"></a>
    <a href="/ru/catalog/drinks/lemonade" class="products-catalog-content__name">GURA Лимонад 0.33л</a>
    <span class="price-products-catalog-content__static">14.89</span>
  </div>`;
  const [product] = extractLinellaProducts(html);
  assert.equal(product.title, "GURA Лимонад 0.33л");
  assert.equal(product.offers[0].price, 14.89);
  assert.equal(product.offers[0].externalUrl, "https://linella.md/ru/catalog/drinks/lemonade");
  assert.equal(product.imageUrl, "https://linella.md/public/products/lemonade.webp");
});

test("discovers public Linella category pages", () => {
  const html = `<a class="title__goto" href="/ru/catalog/frukty">Все</a>
    <a class="title__goto" href="/ru/catalog/frukty">Повтор</a>
    <a class="title__goto" href="/ro/catalog/lactate">RO</a>`;
  assert.deepEqual(extractLinellaCategoryUrls(html), ["https://linella.md/ru/catalog/frukty"]);
});

test("extracts discounted Linella prices", () => {
  const html = `<div class="products-catalog-content__item" data-SKU="385063">
    <a href="/ru/catalog/baby/puree" class="head-products-catalog-content__image"><img src="/public/products/puree.webp"></a>
    <a href="/ru/catalog/baby/puree" class="products-catalog-content__name">GERBER Пюре детское 80г</a>
    <span class="price-products-catalog-content__old">31.90</span>
    <span class="price-products-catalog-content__new">23.90</span>
  </div>`;
  const [product] = extractLinellaProducts(html);
  assert.equal(product.offers[0].price, 23.9);
  assert.equal(product.offers[0].oldPrice, 31.9);
  assert.equal(product.categorySlug, "baby");
});
