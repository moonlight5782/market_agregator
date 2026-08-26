import assert from "node:assert/strict";
import test from "node:test";

process.env.DEMO_MODE = "true";

test("catalog sorts products globally by their minimum offer price", async () => {
  const { searchCatalog } = await import("./catalog-data");
  const ascending = await searchCatalog({ sort: "price-asc" });
  const descending = await searchCatalog({ sort: "price-desc" });
  const ascendingPrices = ascending.products.map((product) => Math.min(...product.offers.map((offer) => Number(offer.price))));
  const descendingPrices = descending.products.map((product) => Math.min(...product.offers.map((offer) => Number(offer.price))));
  assert.deepEqual(ascendingPrices, [...ascendingPrices].sort((a, b) => a - b));
  assert.deepEqual(descendingPrices, [...descendingPrices].sort((a, b) => b - a));
});

test("catalog combines brand and price filters", async () => {
  const { searchCatalog } = await import("./catalog-data");
  const result = await searchCatalog({ brand: "Coca-Cola", minPrice: "20", maxPrice: "35" });
  assert.equal(result.total, 1);
  assert.equal(result.products[0]?.brand, "Coca-Cola");
  assert.ok(result.products[0]?.offers.every((offer) => Number(offer.price) >= 20 && Number(offer.price) <= 35));
});

test("catalog ranks nearby demo offers and respects radius", async () => {
  const { searchCatalog } = await import("./catalog-data");
  const result = await searchCatalog({ sort: "nearest", lat: "47.0247", lon: "28.8322", radius: "10" });
  assert.equal(result.hasGeo, true);
  const distances = result.products.map((product) => product.offers[0]?.distanceKm ?? Number.MAX_VALUE);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
  assert.ok(distances.every((distance) => distance <= 10));
});

test("product pages resolve URL-encoded Cyrillic slugs", async () => {
  const [{ demoProducts }, { getProductBySlug }] = await Promise.all([
    import("./demo-data"),
    import("./product-data"),
  ]);
  const product = demoProducts.find((item) => /[^\x00-\x7F]/.test(item.slug));
  assert.ok(product, "expected a product with a Cyrillic slug in the brochure snapshot");
  const result = await getProductBySlug(encodeURIComponent(product.slug));
  assert.equal(result?.product.id, product.id);
});
