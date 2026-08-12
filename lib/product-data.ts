import { demoProducts } from "./demo-data";

const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;

function freshSince() {
  const configured = Number(process.env.OFFER_MAX_AGE_HOURS ?? 48);
  const hours = Number.isFinite(configured) && configured > 0 ? configured : 48;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function isAvailableStatus(status: string) {
  return status === "IN_STOCK" || status === "LOW_STOCK" || status === "PREORDER";
}

export async function getProductBySlug(slug: string, city?: string) {
  const selectedCity = city?.trim() || undefined;
  if (isDemoMode) {
    const product = demoProducts.find((item) => item.slug === slug);
    if (!product) return null;
    const offers = selectedCity
      ? product.offers.filter((offer) => offer.store.city.toLocaleLowerCase() === selectedCity.toLocaleLowerCase())
      : product.offers;
    return { mode: "demo" as const, product: { ...product, offers } };
  }

  const { prisma } = await import("./prisma");
  const cutoff = freshSince();
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      brand: true,
      offers: {
        where: { lastSeenAt: { gte: cutoff }, store: { active: true } },
        include: {
          store: { include: { locations: { where: { active: true } } } },
          location: true,
          availabilities: {
            where: { lastSeenAt: { gte: cutoff } },
            include: { location: true },
          },
        },
        orderBy: { price: "asc" },
      },
    },
  });
  if (!product) return null;

  const offers = selectedCity
    ? product.offers
        .map((offer) => ({
          ...offer,
          availabilities: offer.availabilities.filter(
            (availability) => availability.location.city.toLocaleLowerCase() === selectedCity.toLocaleLowerCase(),
          ),
        }))
        .filter((offer) => {
          if (offer.availabilities.length > 0) {
            return offer.availabilities.some((availability) => isAvailableStatus(availability.stockStatus));
          }
          const legacyCityMatch = offer.location?.city.toLocaleLowerCase() === selectedCity.toLocaleLowerCase();
          const storeCityMatch = offer.store.locations.some((location) => location.city.toLocaleLowerCase() === selectedCity.toLocaleLowerCase());
          return (legacyCityMatch || storeCityMatch) && offer.stockStatus !== "OUT_OF_STOCK";
        })
    : product.offers;

  return { mode: "db" as const, product: { ...product, offers } };
}
