import { demoProducts } from "./demo-data";

const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;

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
        include: { store: true, location: true },
        orderBy: { price: "asc" },
      },
    },
  });
  return product ? { mode: "db" as const, product } : null;
}
