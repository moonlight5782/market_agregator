import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://croco.md";
const SITEMAP_URL = `${BASE_URL}/sitemap.xml/product`;
const OUTPUT_URL = new URL("../data/croco-products.json", import.meta.url);
const USER_AGENT = "BunPretCatalogIndexer/1.0 (+https://market-agregator-md.moonlight-5782.chatgpt.site)";
const OFFICIAL_STORE_URLS = {
  "cip-market": "https://www.cipmarket.md/ru/",
};

function absoluteUrl(value) {
  return value ? new URL(value.replaceAll("\\/", "/"), BASE_URL).toString() : null;
}

export function extractJsonArray(html, propertyName) {
  const marker = `"${propertyName}":`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return [];
  const start = html.indexOf("[", markerIndex + marker.length);
  if (start < 0) return [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(start, index + 1));
    }
  }
  return [];
}

function stripMarkup(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function classifyProduct(title) {
  const value = title.toLocaleLowerCase("ru");
  if (/телефон|смартфон|ноутбук|телевизор|наушник|заряд|пылесос|холодильник|стиральн|iphone|samsung galaxy/.test(value)) return ["electronics", "Электроника"];
  if (/дрель|шурупов|цемент|штукатур|краск|шпакл|инструмент|ламинат|плитк|клей строитель/.test(value)) return ["construction", "Строительство"];
  if (/шампун|крем |маска|помад|дезодорант|парфюм|зубн|космет/.test(value)) return ["beauty", "Красота и уход"];
  if (/порошок|гель для стир|чистк|мойк|салфет|туалетн|освежител|губк/.test(value)) return ["home", "Дом и быт"];
  if (/корм|лакомств.*кош|лакомств.*собак|наполнитель/.test(value)) return ["pets", "Зоотовары"];
  return ["groceries", "Продукты"];
}

function slugify(value) {
  return stripMarkup(value).toLocaleLowerCase("ru").normalize("NFKD").replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "product";
}

function jsonLdFromHtml(html) {
  const match = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>(https:\/\/croco\.md\/(?:ro|ru)\/catalog\/[^<]+)<\/loc>/g)].map((match) => match[1]).filter((url) => url.includes("/ro/"));
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xml" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function normalizeCatalogProduct(item, metadata, catalogUrl) {
  const title = stripMarkup(item.name_ru || item.name_ro);
  const price = Number(item.new_price || item.price);
  if (!title || !Number.isFinite(price) || price <= 0) return null;
  const oldPrice = Number(item.price);
  const [categorySlug, categoryName] = classifyProduct(title);
  const storeName = stripMarkup(item.store_name_ru || item.store_name_ro || metadata?.location?.name || "Магазин");
  const storeSlug = slugify(storeName);
  const externalId = String(item.id || item.unique_id || `${metadata?.name}-${title}`);
  return {
    id: `croco-${externalId}`,
    slug: `croco-${slugify(title)}-${externalId}`,
    title,
    titleRo: stripMarkup(item.name_ro) || null,
    brand: null,
    categorySlug,
    categoryName,
    imageUrl: absoluteUrl(item.path),
    source: "CROCO_BROCHURE",
    offers: [{
      id: `croco-offer-${externalId}`,
      store: { id: `croco-store-${storeSlug}`, name: storeName, slug: storeSlug, city: "Moldova", openingHours: null, websiteUrl: OFFICIAL_STORE_URLS[storeSlug] || null },
      price,
      oldPrice: Number.isFinite(oldPrice) && oldPrice > price ? oldPrice : undefined,
      currency: "MDL",
      stockStatus: "UNKNOWN",
      externalUrl: item.url ? absoluteUrl(item.url) : catalogUrl.replace("/ro/", "/ru/"),
      sourceName: "Croco.md",
      sourceUrl: catalogUrl.replace("/ro/", "/ru/"),
      validFrom: metadata?.startDate || null,
      validUntil: metadata?.endDate || null,
      catalogPage: item.page || null,
    }],
  };
}

export async function buildSnapshot({ maxCatalogs = 40, maxProducts = 1800, maxProductsPerCatalog = 140 } = {}) {
  const sitemap = await fetchText(SITEMAP_URL);
  const urls = sitemapUrls(sitemap).slice(0, maxCatalogs);
  const today = new Date().toISOString().slice(0, 10);
  const products = [];
  let acceptedCatalogs = 0;
  for (const url of urls) {
    if (products.length >= maxProducts) break;
    try {
      const html = await fetchText(url);
      const metadata = jsonLdFromHtml(html);
      if (metadata?.endDate && metadata.endDate < today) continue;
      const items = extractJsonArray(html, "catalogProducts");
      const normalized = items.map((item) => normalizeCatalogProduct(item, metadata, url)).filter(Boolean).slice(0, maxProductsPerCatalog);
      if (normalized.length) {
        products.push(...normalized.slice(0, Math.max(0, maxProducts - products.length)));
        acceptedCatalogs += 1;
      }
    } catch (error) {
      console.warn(`Croco catalog skipped: ${url}: ${error.message}`);
    }
  }
  return { generatedAt: new Date().toISOString(), source: SITEMAP_URL, catalogs: acceptedCatalogs, products };
}

async function main() {
  const snapshot = await buildSnapshot({
    maxCatalogs: Number(process.env.CROCO_MAX_CATALOGS || 40),
    maxProducts: Number(process.env.CROCO_MAX_PRODUCTS || 1800),
    maxProductsPerCatalog: Number(process.env.CROCO_PRODUCTS_PER_CATALOG || 140),
  });
  await writeFile(fileURLToPath(OUTPUT_URL), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Croco snapshot: ${snapshot.products.length} products from ${snapshot.catalogs} active catalogs`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`))) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
