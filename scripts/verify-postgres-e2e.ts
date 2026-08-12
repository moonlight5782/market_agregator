import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`PostgreSQL E2E assertion failed: ${message}`);
}

async function main() {
  const ean = "4840000000100";
  const products = await prisma.product.findMany({
    where: { ean },
    include: {
      offers: {
        include: {
          store: true,
          priceHistory: { orderBy: { recordedAt: "asc" } },
          availabilities: { include: { location: true } },
        },
      },
    },
  });

  assert(products.length === 1, `expected 1 normalized Product for shared EAN, got ${products.length}`);
  const product = products[0];
  assert(product.offers.length === 2, `expected 2 Offers from two stores, got ${product.offers.length}`);

  const maximum = product.offers.find((offer) => offer.store.slug === "maximum");
  const darwin = product.offers.find((offer) => offer.store.slug === "darwin");
  assert(maximum, "Maximum offer missing");
  assert(darwin, "Darwin offer missing");

  assert(maximum.price.toString() === "849", `Maximum latest price should be 849, got ${maximum.price}`);
  assert(maximum.quantity === 6, `Maximum latest quantity should be 6, got ${maximum.quantity}`);
  assert(maximum.priceHistory.length === 2, `Maximum should have 2 price history rows, got ${maximum.priceHistory.length}`);
  assert(maximum.priceHistory[0].price.toString() === "899", "first Maximum price history should be 899");
  assert(maximum.priceHistory[1].price.toString() === "849", "second Maximum price history should be 849");

  assert(darwin.availabilities.length === 1, `Darwin should have one branch availability, got ${darwin.availabilities.length}`);
  const availability = darwin.availabilities[0];
  assert(availability.location.city === "Chișinău", `expected Chișinău branch, got ${availability.location.city}`);
  assert(availability.quantity === 7, `expected branch quantity 7, got ${availability.quantity}`);
  assert(availability.stockStatus === "LOW_STOCK", `expected LOW_STOCK branch status, got ${availability.stockStatus}`);

  const category = await prisma.category.findUnique({ where: { slug: "home-appliances" } });
  assert(category?.nameRu === "Бытовая техника" && category.nameRo === "Electrocasnice", "RU/RO canonical category seed is missing");

  console.log(JSON.stringify({
    ok: true,
    productId: product.id,
    productCount: products.length,
    offerCount: product.offers.length,
    maximumPriceHistory: maximum.priceHistory.length,
    darwinBranchAvailability: darwin.availabilities.length,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
