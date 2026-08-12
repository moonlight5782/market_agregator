import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

type RegistryStore = {
  slug: string;
  status: string;
};

const prisma = new PrismaClient();

async function main() {
  const registry = JSON.parse(readFileSync("data/store-registry.json", "utf8")) as RegistryStore[];
  const knownSlugs = new Set(registry.map((store) => store.slug));

  for (const store of registry) {
    await prisma.store.updateMany({
      where: { slug: store.slug },
      data: { verified: store.status === "VERIFIED" }
    });
  }

  // A store can exist in the database before it is added to the registry. Never
  // preserve an old verified=true flag when there is no current coverage evidence.
  await prisma.store.updateMany({
    where: {
      verified: true,
      slug: { notIn: [...knownSlugs] }
    },
    data: { verified: false }
  });

  const verified = registry.filter((store) => store.status === "VERIFIED").map((store) => store.slug);
  console.log(`Synchronized Store.verified from coverage registry. VERIFIED: ${verified.join(", ") || "none"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
