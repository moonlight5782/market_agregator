import { PrismaClient } from "@prisma/client";
import locations from "../data/store-locations.json";

const prisma = new PrismaClient();

type LocationSeed = {
  store_slug: string;
  external_id: string;
  name: string;
  city: string;
  address?: string;
  phone?: string;
};

async function main() {
  let seeded = 0;
  for (const item of locations as LocationSeed[]) {
    const store = await prisma.store.findUnique({ where: { slug: item.store_slug }, select: { id: true } });
    if (!store) continue;
    await prisma.storeLocation.upsert({
      where: { storeId_externalId: { storeId: store.id, externalId: item.external_id } },
      update: {
        name: item.name,
        city: item.city,
        address: item.address ?? null,
        phone: item.phone ?? null,
        active: true,
      },
      create: {
        storeId: store.id,
        externalId: item.external_id,
        name: item.name,
        city: item.city,
        address: item.address ?? null,
        phone: item.phone ?? null,
        active: true,
      },
    });
    seeded += 1;
  }
  console.log(`Seeded ${seeded} verified store locations.`);
}

main().finally(() => prisma.$disconnect());
