import { demoProducts } from "./demo-data";

const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;

function freshSince() {
  const configured = Number(process.env.OFFER_MAX_AGE_HOURS ?? 48);
  const hours = Number.isFinite(configured) && configured > 0 ? configured : 48;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export async function getProductBySlug(slug: string) {
  if (isDemoMode) {
    const product = demoProducts.find((item) => item.slug === slug);
    return product ? { mode: "demo" as const, product } : null;
  }

  const { prisma } = await import("./prisma");
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      brand: true,
      offers: {
        where: { lastSeenAt: { gte: freshSince() }, store: { active: true } },
        include: { store: true, location: true },
        orderBy: { price: "asc" },
      },
    },
  });
  return product ? { mode: "db" as const, product } : null;
}
