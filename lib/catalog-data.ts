import { demoCategories, demoProducts, demoStores, getBestOffer } from "./demo-data";

export const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;

function freshSince() {
  const configured = Number(process.env.OFFER_MAX_AGE_HOURS ?? 48);
  const hours = Number.isFinite(configured) && configured > 0 ? configured : 48;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function availableStatuses() {
  return ["IN_STOCK", "LOW_STOCK", "PREORDER"] as const;
}

export async function getAvailableCities() {
  if (isDemoMode) {
    return [...new Set(demoStores.map((store) => store.city))].sort((a, b) => a.localeCompare(b, "ro"));
  }
  const { prisma } = await import("./prisma");
  const rows = await prisma.storeLocation.findMany({
    where: { active: true, store: { active: true } },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });
  return rows.map((row) => row.city);
}

function demoOffersForCity(product: (typeof demoProducts)[number], city?: string) {
  if (!city) return product.offers;
  return product.offers.filter((offer) => offer.store.city.toLocaleLowerCase() === city.toLocaleLowerCase());
}

export async function getHomeData() {
  if (isDemoMode) {
    return {
      mode: "demo" as const,
      categories: demoCategories,
      storeCount: demoStores.length,
      productCount: demoProducts.length,
      offerCount: demoProducts.reduce((sum, product) => sum + product.offers.length, 0),
      latestProducts: demoProducts,
    };
  }

  const { prisma } = await import("./prisma");
  const cutoff = freshSince();
  const freshOfferWhere = { lastSeenAt: { gte: cutoff }, store: { active: true } };
  const [categories, storeCount, productCount, offerCount, latestProducts] = await Promise.all([
    prisma.category.findMany({ where: { parentId: null }, orderBy: { nameRu: "asc" } }),
    prisma.store.count({ where: { active: true } }),
    prisma.product.count({ where: { offers: { some: freshOfferWhere } } }),
    prisma.offer.count({ where: freshOfferWhere }),
    prisma.product.findMany({
      where: { offers: { some: freshOfferWhere } },
      include: {
        category: true,
        brand: true,
        offers: { where: freshOfferWhere, include: { store: true }, orderBy: { price: "asc" }, take: 3 },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  return { mode: "db" as const, categories, storeCount, productCount, offerCount, latestProducts };
}

export async function searchCatalog(q: string, sort: string, city?: string) {
  const selectedCity = city?.trim() || undefined;
  if (isDemoMode) {
    const query = q.trim().toLowerCase();
    const products = demoProducts
      .filter((product) => !query || [product.title, product.brand, product.categoryName].filter(Boolean).some((value) => value!.toLowerCase().includes(query)))
      .map((product) => ({
        ...product,
        offers: [...demoOffersForCity(product, selectedCity)].sort((a, b) => sort === "price-desc" ? b.price - a.price : a.price - b.price),
      }))
      .filter((product) => product.offers.length > 0)
      .sort((a, b) => {
        const aPrice = getBestOffer(a)?.price ?? Number.MAX_VALUE;
        const bPrice = getBestOffer(b)?.price ?? Number.MAX_VALUE;
        return sort === "price-desc" ? bPrice - aPrice : aPrice - bPrice;
      });
    return { mode: "demo" as const, products };
  }

  const { prisma } = await import("./prisma");
  const cutoff = freshSince();
  const cityOfferWhere = selectedCity
    ? {
        OR: [
          {
            availabilities: {
              some: {
                lastSeenAt: { gte: cutoff },
                stockStatus: { in: [...availableStatuses()] },
                location: { active: true, city: { equals: selectedCity, mode: "insensitive" as const } },
              },
            },
          },
          {
            AND: [
              { availabilities: { none: {} } },
              { stockStatus: { not: "OUT_OF_STOCK" as const } },
              { store: { locations: { some: { active: true, city: { equals: selectedCity, mode: "insensitive" as const } } } } },
            ],
          },
        ],
      }
    : {};
  const freshOfferWhere = { lastSeenAt: { gte: cutoff }, store: { active: true }, ...cityOfferWhere };
  const textWhere = q.trim()
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { normalizedTitle: { contains: q.toLowerCase(), mode: "insensitive" as const } },
          { brand: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const products = await prisma.product.findMany({
    where: { AND: [{ offers: { some: freshOfferWhere } }, textWhere] },
    include: {
      category: true,
      brand: true,
      offers: {
        where: freshOfferWhere,
        include: {
          store: true,
          location: true,
          availabilities: {
            where: {
              lastSeenAt: { gte: cutoff },
              ...(selectedCity ? { location: { city: { equals: selectedCity, mode: "insensitive" } } } : {}),
            },
            include: { location: true },
          },
        },
        orderBy: sort === "price-desc" ? { price: "desc" } : { price: "asc" },
      },
    },
    take: 100,
  });
  return { mode: "db" as const, products };
}

export async function getCategoryData(slug: string) {
  if (isDemoMode) {
    const category = demoCategories.find((item) => item.slug === slug);
    if (!category) return null;
    return {
      mode: "demo" as const,
      category: {
        slug: category.slug,
        nameRu: category.nameRu,
        children: [],
        products: demoProducts.filter((product) => product.categorySlug === slug),
      },
    };
  }

  const { prisma } = await import("./prisma");
  const freshOfferWhere = { lastSeenAt: { gte: freshSince() }, store: { active: true } };
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      children: true,
      products: {
        where: { offers: { some: freshOfferWhere } },
        include: { brand: true, offers: { where: freshOfferWhere, include: { store: true }, orderBy: { price: "asc" } } },
        orderBy: { title: "asc" },
        take: 200,
      },
    },
  });
  return category ? { mode: "db" as const, category } : null;
}
