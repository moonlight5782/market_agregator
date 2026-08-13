import { PrismaClient } from "@prisma/client";
import { freshSince, offerMaxAgeHours } from "../lib/freshness";

const prisma = new PrismaClient();

function ageLabel(date?: Date | null) {
  if (!date) return "never";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

async function main() {
  const cutoff = freshSince();
  const stores = await prisma.store.findMany({
    where: { active: true },
    select: {
      id: true,
      slug: true,
      name: true,
      verified: true,
      sources: { where: { enabled: true }, select: { crawlFrequency: true } },
      scraperRuns: { orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: [{ verified: "desc" }, { name: "asc" }],
  });

  const storeIds = stores.map((store) => store.id);
  const [freshCounts, totalCounts] = await Promise.all([
    prisma.offer.groupBy({
      by: ["storeId"],
      where: { storeId: { in: storeIds }, lastSeenAt: { gte: cutoff } },
      _count: { _all: true },
    }),
    prisma.offer.groupBy({
      by: ["storeId"],
      where: { storeId: { in: storeIds } },
      _count: { _all: true },
    }),
  ]);
  const freshByStore = new Map(freshCounts.map((row) => [row.storeId, row._count._all]));
  const totalByStore = new Map(totalCounts.map((row) => [row.storeId, row._count._all]));

  const rows = stores.map((store) => {
    const latest = store.scraperRuns[0];
    const freshOffers = freshByStore.get(store.id) ?? 0;
    const totalOffers = totalByStore.get(store.id) ?? 0;
    const expectedMinutes = store.sources.length ? Math.min(...store.sources.map((source) => source.crawlFrequency)) : 360;
    const overdueMinutes = Math.max(expectedMinutes * 2, 12 * 60);
    const overdue = !latest?.finishedAt || Date.now() - latest.finishedAt.getTime() > overdueMinutes * 60000;
    const freshness = totalOffers === 0 ? "NO_OFFERS" : freshOffers === totalOffers ? "FRESH" : "STALE";
    const health = !latest
      ? "NEVER"
      : latest.status === "FAILED"
        ? "FAILED"
        : latest.status === "PARTIAL"
          ? "PARTIAL"
          : overdue
            ? "STALE_RUN"
            : freshness !== "FRESH"
              ? "STALE_CATALOG"
              : "OK";

    return {
      health,
      store: store.slug,
      verified: store.verified ? "yes" : "no",
      lastRun: ageLabel(latest?.finishedAt),
      status: latest?.status ?? "-",
      found: latest?.productsFound ?? 0,
      imported: latest?.productsImported ?? 0,
      errors: latest?.errors ?? 0,
      freshOffers,
      totalOffers,
      freshness,
    };
  });

  console.table(rows);
  const unhealthy = rows.filter((row) => row.verified === "yes" && row.health !== "OK");
  if (unhealthy.length) {
    console.error(
      `Verified stores requiring attention (offer maximum age: ${offerMaxAgeHours()}h): ` +
      unhealthy.map((row) => `${row.store}:${row.health}`).join(", "),
    );
    process.exitCode = 2;
  }
}

main().finally(() => prisma.$disconnect());
