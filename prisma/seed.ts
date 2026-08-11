import { PrismaClient, CheckoutType, StockStatus } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  ["electronics", "Electronice", "Электроника", null],
  ["smartphones", "Smartphone-uri", "Смартфоны", "electronics"],
  ["laptops", "Laptopuri", "Ноутбуки", "electronics"],
  ["computers", "Calculatoare", "Компьютеры", "electronics"],
  ["tv-audio", "TV și audio", "ТВ и аудио", "electronics"],
  ["home-appliances", "Electrocasnice", "Бытовая техника", null],
  ["home", "Casă", "Дом", null],
  ["furniture", "Mobilă", "Мебель", "home"],
  ["lighting", "Iluminat", "Освещение", "home"],
  ["construction", "Construcții și reparații", "Строительство и ремонт", null],
  ["building-materials", "Materiale de construcții", "Строительные материалы", "construction"],
  ["tools", "Unelte", "Инструменты", "construction"],
  ["electrical", "Echipamente electrice", "Электрика", "construction"],
  ["ventilation", "Ventilație", "Вентиляция", "construction"],
  ["plumbing", "Instalații sanitare", "Сантехника", "construction"],
  ["food", "Produse alimentare", "Продукты питания", null],
  ["drinks", "Băuturi", "Напитки", "food"],
  ["dairy", "Lactate", "Молочные продукты", "food"],
  ["meat", "Carne și mezeluri", "Мясо и колбасы", "food"],
  ["fruit-vegetables", "Fructe și legume", "Фрукты и овощи", "food"],
  ["fashion", "Îmbrăcăminte și încălțăminte", "Одежда и обувь", null],
  ["beauty", "Frumusețe și îngrijire", "Красота и уход", null],
  ["kids", "Copii", "Детские товары", null],
  ["sport", "Sport", "Спорт", null],
  ["auto", "Auto", "Авто", null],
  ["pets", "Animale", "Товары для животных", null],
  ["garden", "Grădină", "Сад", null],
  ["office", "Birou și papetărie", "Офис и канцелярия", null],
  ["books-hobby", "Cărți și hobby", "Книги и хобби", null]
] as const;

const stores = [
  ["darwin", "Darwin", "https://darwin.md", true],
  ["cactus", "Cactus", "https://www.cactus.md", true],
  ["maximum", "MAXIMUM", "https://maximum.md", true],
  ["supraten", "SUPRATEN", "https://supraten.md", true],
  ["bigshop", "Bigshop", "https://bigshop.md", false],
  ["smart", "Smart", "https://smart.md", false],
  ["vic", "VIC", "https://vic.md", false],
  ["pretcorect", "PretCorect", "https://pretcorect.eu", false],
  ["flomaster", "FLOmaster", "https://flomaster.md", false],
  ["infinity-cosmetics", "Infinity Cosmetics", "https://infinity-cosmetics.md", false],
  ["iserviceshop", "iService Shop", "https://iserviceshop.md", false],
  ["casashop", "CasaShop", "https://casashop.md", false],
  ["smarti", "Smarti", "https://smarti.md", false],
  ["mobvaro", "Mobvaro", "https://mobvaro.md", false],
  ["pazl", "Pazl", "https://pazl.md", false],
  ["estel", "ESTEL Moldova", "https://estel.md", false],
  ["marketonline", "MarketOnline", "https://marketonline.md", false],
  ["comfi", "Comfi", "https://comfi.md", false],
  ["fabianosteel", "Fabiano Steel", "https://fabianosteel.md", false],
  ["suplimente", "Suplimente.md", "https://suplimente.md", false],
  ["mamut", "MAMUT", "https://mamut.md", false],
  ["pigeon", "Pigeon", "https://pigeon.md", false],
  ["zegor", "Zegor", "https://zegor.md", false],
  ["gardline", "Gardline", "https://gardline.md", false],
  ["ehome", "eHome", "https://ehome.md", false]
] as const;

async function seedCategories() {
  const bySlug = new Map<string, string>();
  for (const [slug, nameRo, nameRu, parentSlug] of categories) {
    const category = await prisma.category.upsert({
      where: { slug },
      update: { nameRo, nameRu, parentId: parentSlug ? bySlug.get(parentSlug) : null },
      create: { slug, nameRo, nameRu, parentId: parentSlug ? bySlug.get(parentSlug) : null }
    });
    bySlug.set(slug, category.id);
  }
  return bySlug;
}

async function seedStores() {
  const bySlug = new Map<string, string>();
  for (const [slug, name, domain, verified] of stores) {
    const store = await prisma.store.upsert({
      where: { slug },
      update: { name, domain, verified, active: true },
      create: { slug, name, domain, verified, active: true }
    });
    bySlug.set(slug, store.id);
  }

  const sourceSeeds = [
    ["darwin", "https://darwin.md/ru/telefoane/smartphone/samsung"],
    ["cactus", "https://www.cactus.md"],
    ["maximum", "https://maximum.md"],
    ["supraten", "https://supraten.md/ro"]
  ] as const;

  for (const [storeSlug, url] of sourceSeeds) {
    const storeId = bySlug.get(storeSlug)!;
    const exists = await prisma.storeSource.findFirst({ where: { storeId, url } });
    if (!exists) {
      await prisma.storeSource.create({ data: { storeId, url, type: "HTML", enabled: true, crawlFrequency: 360 } });
    }
  }

  return bySlug;
}

async function seedVerifiedProducts(categoryIds: Map<string, string>, storeIds: Map<string, string>) {
  const samsung = await prisma.brand.upsert({ where: { name: "Samsung" }, update: {}, create: { name: "Samsung" } });
  const vents = await prisma.brand.upsert({ where: { name: "Vents" }, update: {}, create: { name: "Vents" } });
  const mono = await prisma.brand.upsert({ where: { name: "Mono" }, update: {}, create: { name: "Mono" } });

  const items = [
    {
      slug: "samsung-galaxy-s25-fe-256gb-navy",
      title: "Samsung Galaxy S25 FE 256 GB Navy",
      normalizedTitle: "samsung galaxy s25 fe 256gb navy",
      brandId: samsung.id,
      categoryId: categoryIds.get("smartphones"),
      attributes: { storageGb: 256, ramGb: 8, screenInches: 6.7, color: "Navy", sim: "Dual SIM" },
      storeId: storeIds.get("darwin")!, externalId: "darwin-s25-fe-s731-256-navy", price: 12799, oldPrice: 15099,
      stockStatus: StockStatus.UNKNOWN,
      externalUrl: "https://darwin.md/ru/smartfon-samsung-galaxy-s25-fe-s731-8-gb-256-gb-dual-sim-5g-tmno-sinii.html",
      dataQuality: 0.84
    },
    {
      slug: "samsung-galaxy-s26-ultra-256gb-black",
      title: "Samsung Galaxy S26 Ultra 256 GB Black",
      normalizedTitle: "samsung galaxy s26 ultra 256gb black",
      brandId: samsung.id,
      categoryId: categoryIds.get("smartphones"),
      attributes: { storageGb: 256, ramGb: 12, screenInches: 6.9, color: "Black", sim: "Dual SIM" },
      storeId: storeIds.get("darwin")!, externalId: "darwin-s26-ultra-s948-256-black", price: 25499, oldPrice: 29999,
      stockStatus: StockStatus.UNKNOWN,
      externalUrl: "https://darwin.md/ru/smartfon-samsung-galaxy-s26-ultra-s948-12-gb-256-gb-dual-sim-5g-chernyi.html",
      dataQuality: 0.84
    },
    {
      slug: "samsung-galaxy-a56-128gb-graphite",
      title: "Samsung Galaxy A56 128 GB Graphite",
      normalizedTitle: "samsung galaxy a56 128gb graphite",
      brandId: samsung.id,
      categoryId: categoryIds.get("smartphones"),
      attributes: { storageGb: 128, ramGb: 8, screenInches: 6.7, color: "Graphite", sim: "Dual SIM" },
      storeId: storeIds.get("darwin")!, externalId: "darwin-a56-a566-128-graphite", price: 7399, oldPrice: 7699,
      stockStatus: StockStatus.IN_STOCK,
      externalUrl: "https://darwin.md/ru/smartfon-samsung-galaxy-a56-a566-8-gb-128-gb-dual-sim-5g-potryasaushchii-grafit.html",
      dataQuality: 0.88
    },
    {
      slug: "vents-ventilator-150-ma",
      title: "Vents Ventilator 150 MA",
      normalizedTitle: "vents ventilator 150 ma",
      brandId: vents.id,
      categoryId: categoryIds.get("ventilation"),
      attributes: { diameterCm: 15, powerW: 26, airflowM3h: 295, noiseDb: 39 },
      storeId: storeIds.get("supraten")!, externalId: "1900471", price: 620, oldPrice: null,
      stockStatus: StockStatus.IN_STOCK,
      quantity: 9,
      externalUrl: "https://supraten.md/ventilator-150-ma-81696-ro",
      dataQuality: 0.96
    },
    {
      slug: "mono-intrerupator-1-clapa-500-002125-100",
      title: "Mono Intrerupator 1 clapa 500-002125-100",
      normalizedTitle: "mono intrerupator 1 clapa 500 002125 100",
      brandId: mono.id,
      categoryId: categoryIds.get("electrical"),
      attributes: { color: "Argintiu", currentA: 10, protection: "IP20", voltageV: 250, type: "Intrerupator" },
      storeId: storeIds.get("supraten")!, externalId: "0360139", price: 47, oldPrice: null,
      stockStatus: StockStatus.IN_STOCK,
      quantity: 42,
      externalUrl: "https://supraten.md/intrerupator-1-clapa-500-002125-100-329107-ro",
      dataQuality: 0.98
    }
  ];

  for (const item of items) {
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title, normalizedTitle: item.normalizedTitle, brandId: item.brandId,
        categoryId: item.categoryId, attributes: item.attributes, dataQuality: item.dataQuality
      },
      create: {
        slug: item.slug, title: item.title, normalizedTitle: item.normalizedTitle,
        brandId: item.brandId, categoryId: item.categoryId, attributes: item.attributes,
        dataQuality: item.dataQuality
      }
    });

    await prisma.offer.upsert({
      where: { storeId_externalId: { storeId: item.storeId, externalId: item.externalId } },
      update: {
        productId: product.id, title: item.title, price: item.price, oldPrice: item.oldPrice,
        stockStatus: item.stockStatus, quantity: item.quantity ?? null, externalUrl: item.externalUrl,
        checkoutType: CheckoutType.EXTERNAL, lastSeenAt: new Date(), lastPriceUpdate: new Date(), lastStockUpdate: new Date()
      },
      create: {
        productId: product.id, storeId: item.storeId, externalId: item.externalId,
        title: item.title, price: item.price, oldPrice: item.oldPrice, currency: "MDL",
        stockStatus: item.stockStatus, quantity: item.quantity ?? null, externalUrl: item.externalUrl,
        checkoutType: CheckoutType.EXTERNAL
      }
    });
  }
}

async function main() {
  const categoryIds = await seedCategories();
  const storeIds = await seedStores();
  await seedVerifiedProducts(categoryIds, storeIds);
  console.log(`Seeded ${categories.length} categories, ${stores.length} stores and verified product snapshots.`);
}

main().finally(() => prisma.$disconnect());
