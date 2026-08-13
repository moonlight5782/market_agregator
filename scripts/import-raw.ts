import { createReadStream, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createInterface } from "node:readline";
import { Prisma, PrismaClient, StockStatus } from "@prisma/client";

const prisma = new PrismaClient();

type RawAvailability = {
  location_external_id?: string | null;
  location_name?: string | null;
  city: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  stock_status?: string;
  quantity?: number | null;
};

type RawLine = {
  store_slug: string;
  external_id?: string | null;
  title: string;
  normalized_title: string;
  brand?: string | null;
  normalized_brand?: string | null;
  sku?: string | null;
  ean?: string | null;
  mpn?: string | null;
  category_slug?: string | null;
  price: string | number;
  old_price?: string | number | null;
  currency?: string;
  stock_status?: string;
  quantity?: number | null;
  url: string;
  image_url?: string | null;
  attributes?: Prisma.InputJsonObject;
  data_quality?: number;
  location_external_id?: string | null;
  availabilities?: RawAvailability[];
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "product";
}

function toStockStatus(value?: string): StockStatus {
  return Object.values(StockStatus).includes(value as StockStatus)
    ? (value as StockStatus)
    : StockStatus.UNKNOWN;
}

async function findMatchingProduct(item: RawLine, brandId?: string) {
  if (item.ean) {
    const byEan = await prisma.product.findFirst({ where: { ean: item.ean } });
    if (byEan) return byEan;
  }
  if (item.mpn && brandId) {
    const byMpn = await prisma.product.findFirst({ where: { mpn: item.mpn, brandId } });
    if (byMpn) return byMpn;
  }
  if (item.sku && brandId) {
    const bySku = await prisma.product.findFirst({ where: { sku: item.sku, brandId } });
    if (bySku) return bySku;
  }
  return prisma.product.findFirst({
    where: {
      normalizedTitle: item.normalized_title,
      ...(brandId ? { brandId } : {}),
    },
  });
}

async function resolveLocation(storeId: string, availability: RawAvailability) {
  const externalId = availability.location_external_id?.trim() || null;
  const city = availability.city.trim();
  const name = availability.location_name?.trim() || availability.address?.trim() || city;
  const address = availability.address?.trim() || null;
  const coordinates = {
    ...(availability.latitude != null ? { latitude: availability.latitude } : {}),
    ...(availability.longitude != null ? { longitude: availability.longitude } : {}),
  };

  if (externalId) {
    return prisma.storeLocation.upsert({
      where: { storeId_externalId: { storeId, externalId } },
      update: { name, address, city, ...coordinates, active: true },
      create: { storeId, externalId, name, address, city, ...coordinates, active: true },
    });
  }

  const existing = await prisma.storeLocation.findFirst({ where: { storeId, city, name, address } });
  if (existing) {
    if (Object.keys(coordinates).length) {
      return prisma.storeLocation.update({ where: { id: existing.id }, data: coordinates });
    }
    return existing;
  }
  return prisma.storeLocation.create({ data: { storeId, name, address, city, ...coordinates, active: true } });
}

async function importAvailabilities(offerId: string, storeId: string, availabilities: RawAvailability[]) {
  for (const availability of availabilities) {
    if (!availability.city?.trim()) continue;
    const location = await resolveLocation(storeId, availability);
    const stockStatus = toStockStatus(availability.stock_status);
    const quantity = availability.quantity ?? null;
    const previous = await prisma.offerAvailability.findUnique({ where: { offerId_locationId: { offerId, locationId: location.id } } });
    await prisma.offerAvailability.upsert({
      where: { offerId_locationId: { offerId, locationId: location.id } },
      update: {
        stockStatus,
        quantity,
        lastSeenAt: new Date(),
        lastStockUpdate: previous && previous.stockStatus === stockStatus && previous.quantity === quantity ? previous.lastStockUpdate : new Date(),
      },
      create: { offerId, locationId: location.id, stockStatus, quantity },
    });
  }
}

async function importItem(item: RawLine) {
  const store = await prisma.store.findUnique({ where: { slug: item.store_slug } });
  if (!store) throw new Error(`Store ${item.store_slug} is missing from DB. Run db:seed first.`);

  const externalId = item.external_id || `${item.store_slug}:${slugify(item.url)}`;
  const brand = item.brand?.trim()
    ? await prisma.brand.upsert({ where: { name: item.brand.trim() }, update: {}, create: { name: item.brand.trim() } })
    : null;
  const category = item.category_slug ? await prisma.category.findUnique({ where: { slug: item.category_slug } }) : null;

  let product = await findMatchingProduct(item, brand?.id);
  if (!product) {
    let slug = slugify(item.normalized_title);
    const collision = await prisma.product.findUnique({ where: { slug } });
    if (collision) slug = `${slug}-${slugify(item.store_slug)}-${slugify(externalId).slice(-24)}`;
    product = await prisma.product.create({
      data: {
        slug,
        title: item.title,
        normalizedTitle: item.normalized_title,
        brandId: brand?.id,
        categoryId: category?.id,
        ean: item.ean || null,
        mpn: item.mpn || null,
        sku: item.sku || null,
        imageUrl: item.image_url || null,
        attributes: item.attributes ?? {},
        dataQuality: item.data_quality ?? 0,
      },
    });
  } else {
    product = await prisma.product.update({
      where: { id: product.id },
      data: {
        title: item.title,
        brandId: product.brandId || brand?.id,
        categoryId: product.categoryId || category?.id,
        ean: product.ean || item.ean || null,
        mpn: product.mpn || item.mpn || null,
        sku: product.sku || item.sku || null,
        imageUrl: product.imageUrl || item.image_url || null,
        dataQuality: Math.max(product.dataQuality, item.data_quality ?? 0),
      },
    });
  }

  const previous = await prisma.offer.findUnique({ where: { storeId_externalId: { storeId: store.id, externalId } } });
  const stockStatus = toStockStatus(item.stock_status);
  const offer = await prisma.offer.upsert({
    where: { storeId_externalId: { storeId: store.id, externalId } },
    update: {
      productId: product.id,
      title: item.title,
      price: item.price,
      oldPrice: item.old_price ?? null,
      currency: item.currency || "MDL",
      stockStatus,
      quantity: item.quantity ?? null,
      externalUrl: item.url,
      imageUrl: item.image_url || null,
      lastSeenAt: new Date(),
      lastPriceUpdate: previous && previous.price.toString() === String(item.price) ? previous.lastPriceUpdate : new Date(),
      lastStockUpdate: previous && previous.stockStatus === stockStatus && previous.quantity === (item.quantity ?? null) ? previous.lastStockUpdate : new Date(),
    },
    create: {
      productId: product.id,
      storeId: store.id,
      externalId,
      title: item.title,
      price: item.price,
      oldPrice: item.old_price ?? null,
      currency: item.currency || "MDL",
      stockStatus,
      quantity: item.quantity ?? null,
      externalUrl: item.url,
      imageUrl: item.image_url || null,
    },
  });

  if (item.availabilities?.length) await importAvailabilities(offer.id, store.id, item.availabilities);
  if (!previous || previous.price.toString() !== String(item.price)) await prisma.priceHistory.create({ data: { offerId: offer.id, price: item.price } });
  return { product, offer, matched: Boolean(previous) };
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run data:import -- data/raw/<store>.ndjson");

  const input = createInterface({ input: createReadStream(file, { encoding: "utf-8" }), crlfDelay: Infinity });
  let imported = 0;
  let failed = 0;
  for await (const line of input) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line) as RawLine;
      await importItem(item);
      imported += 1;
      if (imported % 100 === 0) console.log(`Imported ${imported} rows...`);
    } catch (error) {
      failed += 1;
      console.error(`[FAIL ${basename(file)}:${imported + failed}]`, error);
    }
  }

  const summary = { file, imported, failed, total: imported + failed, completedAt: new Date().toISOString() };
  console.log(`Done: ${imported} imported, ${failed} failed.`);
  if (process.env.IMPORT_SUMMARY_PATH) {
    writeFileSync(process.env.IMPORT_SUMMARY_PATH, JSON.stringify(summary, null, 2), "utf-8");
  }
  if (failed > 0) process.exitCode = 2;
}

main().finally(() => prisma.$disconnect());