import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://croco.md";
const SITEMAP_URL = `${BASE_URL}/sitemap.xml/product`;
const OUTPUT_URL = new URL("../data/croco-products.json", import.meta.url);
const USER_AGENT = "BunPretCatalogIndexer/1.0 (+https://market-agregator-md.moonlight-5782.chatgpt.site)";
const OFFICIAL_STORE_URLS = {
  "cip-market": "https://www.cipmarket.md/ru/",
  "metro": "https://www.metro.md/",
  "linella": "https://linella.md/ru/home",
  "kaufland": "https://www.kaufland.md/ru/",
  "nr1": "https://nr1.md/ru/",
  "alcomarket": "https://alcomarket.md/ru",
  "local-discounter": "https://mylocal.md/ru/",
  "rogob": "https://rogob.md/",
  "jysk": "https://jysk.md/",
  "maximum": "https://maximum.md/",
  "ocean-fish": "https://oceanfish.md/",
  "drinkstock": "https://drinkstock.md/",
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

export function classifyProduct(title, sourceCategory = "") {
  const value = title.toLocaleLowerCase("ru").replaceAll("ё", "е");
  const source = sourceCategory.toLocaleLowerCase("ru").replaceAll("ё", "е");
  const sourceRules = [
    ["beauty", "Красота и уход", /космет|gigien|gigienyi|макияж|uhod_|parfyum|dezodor|sredstva_dlya_volos|uhod_za_telom|solnechnaya_seriya/],
    ["electronics", "Электроника", /byitovyie_priboryi|elektronik|telefonyi|kompyuter|audio|video/],
    ["construction", "Строительство", /stroitel|instrument|remont|kraski|shtukatur|cement/],
    ["kids", "Игрушки", /igrush|detskie_igryi|aksessuaryi_dlya_prazdnikov/],
    ["baby", "Детские товары", /detskoe_pitanie|podguz|tovaryi_dlya_malyishey/],
    ["sport", "Спорт", /sport|plavani|turizm|kemping/],
    ["auto", "Автотовары", /avtotovar|avtomobil/],
    ["garden", "Сад и огород", /sad_|ogorod|rasteniya|udobren/],
    ["fashion", "Одежда и обувь", /odejda|obuv|aksessuaryi_odejdyi/],
    ["books-hobby", "Книги и хобби", /knigi|kantselyar|tvorchestv|literatura|roman|detektiv|vyimyisel|filosofiya|vospominaniya|aksessuaryi_dlya_risovaniya/],
    ["pets", "Зоотовары", /zootovar|korm_dlya/],
    ["alcohol", "Алкоголь", /(^|_)(vino|pivo|vodka|viski|konyak|divin|igristoe_vino)(_|$)/],
    ["drinks", "Напитки", /napitki|voda_|soki|kofe|chay/],
    ["meat-fish", "Мясо и рыба", /myaso|ryiba|kolbasa|kolbasyi|sosiski|parizer|vetchina|moreproduktyi/],
    ["dairy", "Молочные продукты", /molochnyie|syir|tvorog|smetana|yogurt|yaytsa/],
    ["sweets", "Сладости", /konditerskie|shokolad|konfetyi|morojenoe|pechene|tortyi|deserturi|desertyi|vafli|biscuiti/],
    ["produce", "Овощи и фрукты", /(^|_)(ovoschi|fruktyi)(_|$)|svejie_(ovoschi|fruktyi)|fruktyi_i_yagodyi|salatyi_i_zelen/],
    ["home", "Дом и быт", /hranenie|byitovaya_himiya|posuda|tekstil|tovaryi_dlya_doma|dekor|sredstva_dlya_stirki|moyuschie_i_chistyaschie|hozyaystvennyiy_inventar|bumajnaya_produktsiya|vse_dlya_uborki|vlajnyie_salfetki/],
    ["groceries", "Продукты", /solenya|konservyi|spetsii|uksus_i_maslo|sousyi_i_zapravki|pitstsa|zamoroj|fast_food|fel_principal|platsindyi|salate|gribyi|maslo_i_margarin|mamalyiga/],
  ];
  for (const [slug, name, pattern] of sourceRules) {
    if (pattern.test(source)) return [slug, name];
  }
  if (/телефон|смартфон|ноутбук|телевизор|наушник|зарядн|пылесос|холодильник|стиральн(?:ая|ую|ые)?\s+машин|iphone|samsung galaxy|увлажнител|ламинатор|батарейк/.test(value)) return ["electronics", "Электроника"];
  if (/дрель|шурупов|цемент|штукатур|шпакл|строительн.*инструмент|ламинат(?:\s|$)|клей\s+строитель|краск.*(?:стен|фасад|интерьер|эмаль)|(?:керамическ|настенн|напольн|тротуарн).*плитк/.test(value)) return ["construction", "Строительство"];
  if (/книг|буквар|сказан|умные карточки|энциклопед|роман\b|эксмо|росмэн|махаон|тетрад|дневник ученика|альбом для рисован|канцеляр|шариковая ручка|гелевая ручка|карандаш|фломастер|бумаг.*(?:а4|копирован|фото)|обложк.*тетрад/.test(value)) return ["books-hobby", "Книги и хобби"];
  if (/игруш|кукл|конструктор|набор.*песк|набор-ведер|водян.*пистолет|машинка дет|настольн.*игр|надувн.*(?:круг|жилет|бассейн)|бассейн.*надувн|пляжн.*мяч/.test(value)) return ["kids", "Игрушки"];
  if (/для плаван|гантел|фитнес|спортив|мяч\b|ракетк|коврик.*йог|карты игральн/.test(value)) return ["sport", "Спорт"];
  if (/автомоб|масло мотор|омыват|автошампун|щетк.*стекл/.test(value)) return ["auto", "Автотовары"];
  if (/растени|горшок|кашпо|садов|семена\s+(?:цвет|овощ|газон|для посад)|удобрени|шланг|орхиде|роза\s+в\s+(?:горш|стакан)/.test(value)) return ["garden", "Сад и огород"];
  if (!/вешалк/.test(value) && /одежд|обув|тапоч|футболк|носк|колгот|шлепан|рюкзак|сумк/.test(value)) return ["fashion", "Одежда и обувь"];
  if (/шампун|крем(?:\s|$)|маска\s+(?:для|лица|волос)|помад|дезодорант|парфюм|зубн|космет|краск.*волос|гель\s+для\s+душ|для\s+брить|после\s+брить|кассет.*брить/.test(value)) return ["beauty", "Красота и уход"];
  if (/порошок|гель\s+для\s+стир|(?:капсул|средств|кондиционер).*(?:стир|бель)|чистк|мойк|моющ|салфет|туалетн(?:ая|ую|ой)?\s+(?:бумаг|вода)|освежител|губк|стол(?:\s|$)|столик|стул|кресл|шкаф|комод|кроват|матрас|подуш|одеял|полотенц|мебел|зеркал|штор|ковр|полк|корзин|емкост.*хранен|упаковк.*подар|удален.*накип|тарелк|чашк|ведро|контейнер|вешалк/.test(value)) return ["home", "Дом и быт"];
  if (/корм|лакомств.*кош|лакомств.*собак|наполнитель/.test(value)) return ["pets", "Зоотовары"];
  if (/подгуз|детск.*питан|пюре дет|молочн.*смесь|pampers|huggies/.test(value)) return ["baby", "Детские товары"];
  if (!/марин|сол|консерв|пюре|напит|йогурт|шоколад|вода|сок|со вкусом/.test(value) && /помидор|томат\s+свеж|огурц|яблок|банан|апельсин|овощ|фрукт|картоф|морков/.test(value)) return ["produce", "Овощи и фрукты"];
  if (/(?:^|\s)(?:пиво|вино|водка|виски|коньяк|дивин|бренди|ром|джин|ликер|аперитив|просекко)(?:\s|,|$)|игристое\s+вино/.test(value)) return ["alcohol", "Алкоголь"];
  if (/вода|напиток|сок|нектар|кофе|чай|лимонад|квас|энергетик/.test(value)) return ["drinks", "Напитки"];
  if (/мяс|колбас|сосиск|ветчин|рыб|куриц|свинин|говядин|филе|фарш|пельмен|балык/.test(value)) return ["meat-fish", "Мясо и рыба"];
  if (/шоколад|конфет|печенье|торт|морожен|вафл|батончик|мармелад|круассан/.test(value)) return ["sweets", "Сладости"];
  if (!/майонез/.test(value) && /молок|сыр|творог|сметан|йогурт|кефир|масло слив|сливк|яйц|маскарпон/.test(value)) return ["dairy", "Молочные продукты"];
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
      if (metadata?.startDate && metadata.startDate > today) continue;
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
