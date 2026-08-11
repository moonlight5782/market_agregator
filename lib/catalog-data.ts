import { demoCategories, demoProducts, demoStores, getBestOffer } from "./demo-data";

export const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;

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
  const [categories, storeCount, productCount, offerCount, latestProducts] = await Promise.all([
    prisma.category.findMany({ where: { parentId: null }, orderBy: { nameRu: "asc" } }),
    prisma.store.count({ where: { active: true } }),
    prisma.product.count(),
    prisma.offer.count(),
    prisma.product.findMany({
      include: { category: true, brand: true, offers: { include: { store: true }, orderBy: { price: "asc" }, take: 3 } },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);

  return { mode: "db" as const, categories, storeCount, productCount, offerCount, latestProducts };
}

export async function searchCatalog(q: string, sort: string) {
  if (isDemoMode) {
    const query = q.trim().toLowerCase();
    const products = demoProducts
      .filter((product) => !query || [product.title, product.brand, product.categoryName].filter(Boolean).some((value) => value!.toLowerCase().includes(query)))
      .map((product) => ({ ...product, offers: [...product.offers].sort((a, b) => sort === "price-desc" ? b.price - a.price : a.price - b.price) }))
      .sort((a, b) => {
        const aPrice = getBestOffer(a)?.price ?? Number.MAX_VALUE;
        const bPrice = getBestOffer(b)?.price ?? Number.MAX_VALUE;
        return sort === "price-desc" ? bPrice - aPrice : aPrice - bPrice;
      });
    return { mode: "demo" as const, products };
  }

  const { prisma } = await import("./prisma");
  const products = q
    ? await prisma.product.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { normalizedTitle: { contains: q.toLowerCase(), mode: "insensitive" } },
            { brand: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        include: {
          category: true,
          brand: true,
          offers: {
            include: { store: true, location: true },
            orderBy: sort === "price-desc" ? { price: "desc" } : { price: "asc" },
          },
        },
        take: 100,
      })
    : [];
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
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      children: true,
      products: {
        include: { brand: true, offers: { include: { store: true }, orderBy: { price: "asc" } } },
        orderBy: { title: "asc" },
        take: 200,
      },
    },
  });
  return category ? { mode: "db" as const, category } : null;
}
