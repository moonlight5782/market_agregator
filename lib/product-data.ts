import { demoProducts } from "./demo-data";
import { freshSince } from "./freshness";
import { haversineKm, parseCoordinate, parseRadiusKm, validCoordinates } from "./geo";

const isDemoMode = process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;

function isAvailableStatus(status: string) {
  return status === "IN_STOCK" || status === "LOW_STOCK" || status === "PREORDER";
}

export type ProductLocationOptions = {
  city?: string;
  lat?: string;
  lon?: string;
  radius?: string;
};

export async function getProductBySlug(slug: string, options: ProductLocationOptions | string = {}) {
  const params = typeof options === "string" ? { city: options } : options;
  const selectedCity = params.city?.trim() || undefined;
  const latitude = parseCoordinate(params.lat);
  const longitude = parseCoordinate(params.lon);
  const hasGeo = validCoordinates(latitude, longitude);
  const radiusKm = parseRadiusKm(params.radius, 10);

  if (isDemoMode) {
    const product = demoProducts.find((item) => item.slug === slug);
    if (!product) return null;
    const offers = selectedCity
      ? product.offers.filter((offer) => offer.store.city.toLocaleLowerCase() === selectedCity.toLocaleLowerCase())
      : product.offers;
    return { mode: "demo" as const, product: { ...product, offers }, hasGeo: false, radiusKm };
  }

  const { prisma } = await import("./prisma");
  const cutoff = freshSince();
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      brand: true,
      offers: {
        where: { lastSeenAt: { gte: cutoff }, store: { active: true, verified: true } },
        include: {
          store: true,
          location: true,
          availabilities: {
            where: {
              lastSeenAt: { gte: cutoff },
              stockStatus: { in: ["IN_STOCK", "LOW_STOCK", "PREORDER"] },
              location: { active: true },
            },
            include: { location: true },
          },
        },
        orderBy: { price: "asc" },
      },
    },
  });
  if (!product) return null;

  const origin = hasGeo ? { latitude: latitude!, longitude: longitude! } : null;
  const offers = product.offers
    .map((offer) => {
      const candidates = offer.availabilities
        .filter((availability) => {
          if (selectedCity && availability.location.city.toLocaleLowerCase() !== selectedCity.toLocaleLowerCase()) return false;
          return isAvailableStatus(availability.stockStatus);
        })
        .map((availability) => {
          const location = availability.location;
          const distanceKm = origin && validCoordinates(location.latitude, location.longitude)
            ? haversineKm(origin, { latitude: location.latitude!, longitude: location.longitude! })
            : null;
          return { availability, distanceKm };
        })
        .filter((entry) => !hasGeo || (entry.distanceKm != null && entry.distanceKm <= radiusKm))
        .sort((a, b) => (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE));

      const nearest = candidates[0];
      return {
        ...offer,
        availabilities: candidates.map((entry) => entry.availability),
        nearestLocation: nearest?.availability.location ?? null,
        distanceKm: nearest?.distanceKm ?? null,
      };
    })
    .filter((offer) => {
      if (selectedCity || hasGeo) return offer.availabilities.length > 0;
      if (offer.availabilities.length > 0) return true;
      return isAvailableStatus(offer.stockStatus);
    })
    .sort((a, b) => {
      if (hasGeo) {
        const distanceDelta = (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE);
        if (distanceDelta !== 0) return distanceDelta;
      }
      return Number(a.price) - Number(b.price);
    });

  return { mode: "db" as const, product: { ...product, offers }, hasGeo, radiusKm };
}
