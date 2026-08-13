import { demoCategories, demoProducts, demoStores, getBestOffer } from "./demo-data";
import { haversineKm, parseCoordinate, parseRadiusKm, validCoordinates } from "./geo";

export const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;

const DEFAULT_PAGE_SIZE = 48;
const MAX_PAGE_SIZE = 100;

function freshSince() {
  const configured = Number(process.env.OFFER_MAX_AGE_HOURS ?? 48);
  const hours = Number.isFinite(configured) && configured > 0 ? configured : 48;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function availableStatuses() {
  return ["IN_STOCK", "LOW_STOCK", "PREORDER"] as const;
}

function pageNumber(value?: string | number) {
  const parsed = Number(value ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function pageSize(value?: string | number) {
  const parsed = Number(value ?? DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(parsed), MAX_PAGE_SIZE);
}

export async function getAvailableCities() {
  if (isDemoMode) {
    return [...new Set(demoStores.map((store) => store.city))].sort((a, b) => a.localeCompare(b, "ro"));
  }
  const { prisma } = await import("./prisma");
  const rows = await prisma.storeLocation.findMany({
    where: { active: true, store: { active: true, verified: true } },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });
  return rows.map((row) => row.city);
}

export async function getAvailableStores() {
  if (isDemoMode) {
    return [...demoStores].sort((a, b) => a.name.localeCompare(b.name, "ro")).map(({ slug, name }) => ({ slug, name }));
  }
  const { prisma } = await import("./prisma");
  return prisma.store.findMany({
    where: { active: true, verified: true },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
}

function demoOffersForFilters(product: (typeof demoProducts)[number], city?: string, store?: string) {
  return product.offers.filter((offer) => {
    if (city && offer.store.city.toLocaleLowerCase() !== city.toLocaleLowerCase()) return false;
    if (store && offer.store.slug !== store) return false;
    return true;
  });
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
  const freshOfferWhere = { lastSeenAt: { gte: cutoff }, store: { active: true, verified: true } };
  const [categories, storeCount, productCount, offerCount, latestProducts] = await Promise.all([
    prisma.category.findMany({ where: { parentId: null }, orderBy: { nameRu: "asc" } }),
    prisma.store.count({ where: { active: true, verified: true } }),
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

export type SearchCatalogOptions = {
  q?: string;
  sort?: string;
  city?: string;
  store?: string;
  lat?: string;
  lon?: string;
  radius?: string;
  page?: string | number;
  pageSize?: string | number;
};

async function radiusLocations(latitude: number, longitude: number, radiusKm: number) {
  const { prisma } = await import("./prisma");
  const locations = await prisma.storeLocation.findMany({
    where: {
      active: true,
      latitude: { not: null },
      longitude: { not: null },
      store: { active: true, verified: true },
    },
    select: { id: true, latitude: true, longitude: true },
  });
  const origin = { latitude, longitude };
  return locations
    .filter((location) => validCoordinates(location.latitude, location.longitude))
    .map((location) => ({
      id: location.id,
      distanceKm: haversineKm(origin, { latitude: location.latitude!, longitude: location.longitude! }),
    }))
    .filter((location) => location.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function searchCatalog(options: SearchCatalogOptions | string, legacySort?: string, legacyCity?: string) {
  const params: SearchCatalogOptions = typeof options === "string"
    ? { q: options, sort: legacySort, city: legacyCity }
    : options;
  const q = params.q?.trim() ?? "";
  const sort = params.sort ?? "price-asc";
  const selectedCity = params.city?.trim() || undefined;
  const selectedStore = params.store?.trim() || undefined;
  const currentPage = pageNumber(params.page);
  const perPage = pageSize(params.pageSize);
  const latitude = parseCoordinate(params.lat);
  const longitude = parseCoordinate(params.lon);
  const hasGeo = validCoordinates(latitude, longitude);
  const radiusKm = parseRadiusKm(params.radius, 10);

  if (isDemoMode) {
    const query = q.toLowerCase();
    const allProducts = demoProducts
      .filter((product) => !query || [product.title, product.brand, product.categoryName].filter(Boolean).some((value) => value!.toLowerCase().includes(query)))
      .map((product) => ({
        ...product,
        offers: [...demoOffersForFilters(product, selectedCity, selectedStore)].sort((a, b) => sort === "price-desc" ? b.price - a.price : a.price - b.price),
      }))
      .filter((product) => product.offers.length > 0)
      .sort((a, b) => {
        const aPrice = getBestOffer(a)?.price ?? Number.MAX_VALUE;
        const bPrice = getBestOffer(b)?.price ?? Number.MAX_VALUE;
        return sort === "price-desc" ? bPrice - aPrice : aPrice - bPrice;
      });
    const total = allProducts.length;
    const products = allProducts.slice((currentPage - 1) * perPage, currentPage * perPage);
    return { mode: "demo" as const, products, total, page: currentPage, pageSize: perPage, totalPages: Math.max(1, Math.ceil(total / perPage)), radiusKm, hasGeo: false };
  }

  const { prisma } = await import("./prisma");
  const cutoff = freshSince();
  const nearby = hasGeo ? await radiusLocations(latitude!, longitude!, radiusKm) : [];
  const nearbyIds = nearby.map((item) => item.id);
  const distanceByLocation = new Map(nearby.map((item) => [item.id, item.distanceKm]));

  const availabilityWhere = selectedCity || hasGeo
    ? {
        some: {
          lastSeenAt: { gte: cutoff },
          stockStatus: { in: [...availableStatuses()] },
          location: {
            active: true,
            ...(selectedCity ? { city: { equals: selectedCity, mode: "insensitive" as const } } : {}),
            ...(hasGeo ? { id: { in: nearbyIds } } : {}),
          },
        },
      }
    : undefined;

  const freshOfferWhere = {
    lastSeenAt: { gte: cutoff },
    store: {
      active: true,
      verified: true,
      ...(selectedStore ? { slug: selectedStore } : {}),
    },
    ...(availabilityWhere ? { availabilities: availabilityWhere } : { stockStatus: { in: [...availableStatuses()] } }),
  };

  const textWhere = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { normalizedTitle: { contains: q.toLowerCase(), mode: "insensitive" as const } },
          { brand: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const productWhere = { AND: [{ offers: { some: freshOfferWhere } }, textWhere] };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where: productWhere }),
    prisma.product.findMany({
      where: productWhere,
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
                stockStatus: { in: [...availableStatuses()] },
                location: {
                  active: true,
                  ...(selectedCity ? { city: { equals: selectedCity, mode: "insensitive" } } : {}),
                  ...(hasGeo ? { id: { in: nearbyIds } } : {}),
                },
              },
              include: { location: true },
            },
          },
          orderBy: sort === "price-desc" ? { price: "desc" } : { price: "asc" },
        },
      },
      orderBy: sort === "price-desc" ? { title: "desc" } : { title: "asc" },
      skip: (currentPage - 1) * perPage,
      take: perPage,
    }),
  ]);

  const products = rows.map((product) => {
    const offers = product.offers
      .map((offer) => {
        const nearest = offer.availabilities
          .map((availability) => ({ availability, distanceKm: distanceByLocation.get(availability.locationId) }))
          .filter((entry) => entry.distanceKm != null)
          .sort((a, b) => a.distanceKm! - b.distanceKm!)[0];
        return {
          ...offer,
          distanceKm: nearest?.distanceKm ?? null,
          nearestLocation: nearest?.availability.location ?? null,
        };
      })
      .sort((a, b) => {
        if (sort === "nearest" && hasGeo) return (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE);
        return sort === "price-desc" ? Number(b.price) - Number(a.price) : Number(a.price) - Number(b.price);
      });
    return { ...product, offers };
  });

  return {
    mode: "db" as const,
    products,
    total,
    page: currentPage,
    pageSize: perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    radiusKm,
    hasGeo,
  };
}

export async function getCategoryData(slug: string, page = 1, requestedPageSize = DEFAULT_PAGE_SIZE) {
  const currentPage = pageNumber(page);
  const perPage = pageSize(requestedPageSize);
  if (isDemoMode) {
    const category = demoCategories.find((item) => item.slug === slug);
    if (!category) return null;
    const allProducts = demoProducts.filter((product) => product.categorySlug === slug);
    return {
      mode: "demo" as const,
      category: {
        slug: category.slug,
        nameRu: category.nameRu,
        children: [],
        products: allProducts.slice((currentPage - 1) * perPage, currentPage * perPage),
      },
      total: allProducts.length,
      page: currentPage,
      pageSize: perPage,
      totalPages: Math.max(1, Math.ceil(allProducts.length / perPage)),
    };
  }

  const { prisma } = await import("./prisma");
  const freshOfferWhere = {
    lastSeenAt: { gte: freshSince() },
    store: { active: true, verified: true },
    stockStatus: { in: [...availableStatuses()] },
  };
  const categoryBase = await prisma.category.findUnique({ where: { slug }, include: { children: true } });
  if (!categoryBase) return null;
  const productWhere = { categoryId: categoryBase.id, offers: { some: freshOfferWhere } };
  const [total, products] = await Promise.all([
    prisma.product.count({ where: productWhere }),
    prisma.product.findMany({
      where: productWhere,
      include: { brand: true, offers: { where: freshOfferWhere, include: { store: true }, orderBy: { price: "asc" } } },
      orderBy: { title: "asc" },
      skip: (currentPage - 1) * perPage,
      take: perPage,
    }),
  ]);
  return {
    mode: "db" as const,
    category: { ...categoryBase, products },
    total,
    page: currentPage,
    pageSize: perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}
