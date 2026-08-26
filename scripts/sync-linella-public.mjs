import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { classifyProduct } from "./sync-croco-public.mjs";

const BASE_URL = "https://linella.md";
const CATALOG_URL = `${BASE_URL}/ru/home`;
const OUTPUT_URL = new URL("../data/linella-products.json", import.meta.url);
const USER_AGENT = "BunPretCatalogIndexer/1.0 (+https://market-agregator-md.moonlight-5782.chatgpt.site)";

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function numberFrom(value) {
  if (!value) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function absoluteUrl(value) {
  return value ? new URL(decodeHtml(value), BASE_URL).toString() : null;
}

export function extractLinellaProducts(html) {
  const products = new Map();
  for (const chunk of html.split(/<div class="products-catalog-content__item/).slice(1)) {
    const sku = chunk.match(/data-SKU="([^"]+)"/)?.[1]?.trim();
    const productLink = chunk.match(/href="([^"]+)" class="products-catalog-content__name">([\s\S]*?)<\/a>/);
    const title = decodeHtml(productLink?.[2]);
    const price = numberFrom(
      chunk.match(/price-products-catalog-content__new">\s*([\d.,]+)/)?.[1]
      || chunk.match(/price-products-catalog-content__static">\s*([\d.,]+)/)?.[1],
    );
    if (!sku || !title || !price || !productLink?.[1]) continue;
    const oldPrice = numberFrom(chunk.match(/price-products-catalog-content__old">\s*([\d.,]+)/)?.[1]);
    const imagePath = chunk.match(/class="head-products-catalog-content__image">[\s\S]*?<img src="([^"]+)"/)?.[1];
    const [categorySlug, categoryName] = classifyProduct(title);
    products.set(sku, {
      id: `linella-${sku}`,
      slug: `linella-${sku}`,
      title,
      brand: null,
      categorySlug,
      categoryName,
      imageUrl: absoluteUrl(imagePath),
      source: "LINELLA_DIRECT",
      offers: [{
        id: `linella-direct-${sku}`,
        store: {
          id: "linella-direct-store",
          name: "Linella",
          slug: "linella",
          city: "Moldova",
          openingHours: null,
          websiteUrl: "https://linella.md/ru/home",
        },
        price,
        oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
        currency: "MDL",
        stockStatus: "IN_STOCK",
        externalUrl: absoluteUrl(productLink[1]),
      }],
    });
  }
  return [...products.values()];
}

export function extractLinellaCategoryUrls(html) {
  const paths = new Set();
  for (const match of html.matchAll(/<a\s+class="title__goto"\s+href="([^"]+)"/g)) {
    if (match[1].startsWith("/ru/")) paths.add(match[1]);
  }
  return [...paths].map((path) => new URL(decodeHtml(path), BASE_URL).toString());
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

export async function buildLinellaSnapshot({ maxCategoryPages = 24, maxProducts = 1200 } = {}) {
  const homeHtml = await fetchText(CATALOG_URL);
  const products = new Map(extractLinellaProducts(homeHtml).map((product) => [product.id, product]));
  const categoryUrls = extractLinellaCategoryUrls(homeHtml).slice(0, maxCategoryPages);
  for (let index = 0; index < categoryUrls.length && products.size < maxProducts; index += 4) {
    const batch = categoryUrls.slice(index, index + 4);
    const pages = await Promise.all(batch.map(async (url) => {
      try { return await fetchText(url); }
      catch (error) { console.warn(`Linella category skipped: ${url}: ${error.message}`); return ""; }
    }));
    for (const html of pages) {
      for (const product of extractLinellaProducts(html)) {
        if (products.size >= maxProducts) break;
        products.set(product.id, product);
      }
    }
  }
  if (!products.size) throw new Error("Linella public catalog did not contain product cards");
  return { generatedAt: new Date().toISOString(), source: CATALOG_URL, categoryPages: categoryUrls.length, products: [...products.values()] };
}

async function main() {
  const snapshot = await buildLinellaSnapshot({
    maxCategoryPages: Number(process.env.LINELLA_MAX_CATEGORY_PAGES || 24),
    maxProducts: Number(process.env.LINELLA_MAX_PRODUCTS || 1200),
  });
  await writeFile(fileURLToPath(OUTPUT_URL), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Linella snapshot: ${snapshot.products.length} direct product cards from ${snapshot.categoryPages} category pages`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`))) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
