import { PrismaClient } from "@prisma/client";
import locations from "../data/store-locations.json";

const prisma = new PrismaClient();

type LocationSeed = {
  store_slug: string;
  external_id: string;
  name: string;
  city: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
};

async function main() {
  let seeded = 0;
  for (const item of locations as LocationSeed[]) {
    const store = await prisma.store.findUnique({ where: { slug: item.store_slug }, select: { id: true } });
    if (!store) continue;
    const coordinates = {
      ...(item.latitude != null ? { latitude: item.latitude } : {}),
      ...(item.longitude != null ? { longitude: item.longitude } : {}),
    };
    await prisma.storeLocation.upsert({
      where: { storeId_externalId: { storeId: store.id, externalId: item.external_id } },
      update: {
        name: item.name,
        city: item.city,
        address: item.address ?? null,
        phone: item.phone ?? null,
        ...coordinates,
        active: true,
      },
      create: {
        storeId: store.id,
        externalId: item.external_id,
        name: item.name,
        city: item.city,
        address: item.address ?? null,
        phone: item.phone ?? null,
        ...coordinates,
        active: true,
      },
    });
    seeded += 1;
  }
  console.log(`Seeded ${seeded} store locations.`);
}

main().finally(() => prisma.$disconnect());
