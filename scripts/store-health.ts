import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function freshSince() {
  const configured = Number(process.env.OFFER_MAX_AGE_HOURS ?? 48);
  const hours = Number.isFinite(configured) && configured > 0 ? configured : 48;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

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

  const rows = [];
  for (const store of stores) {
    const latest = store.scraperRuns[0];
    const freshOffers = await prisma.offer.count({ where: { storeId: store.id, lastSeenAt: { gte: cutoff } } });
    const totalOffers = await prisma.offer.count({ where: { storeId: store.id } });
    const expectedMinutes = store.sources.length ? Math.min(...store.sources.map((source) => source.crawlFrequency)) : 360;
    const overdueMinutes = Math.max(expectedMinutes * 2, 12 * 60);
    const overdue = !latest?.finishedAt || Date.now() - latest.finishedAt.getTime() > overdueMinutes * 60000;
    const health = !latest
      ? "NEVER"
      : latest.status === "FAILED"
        ? "FAILED"
        : latest.status === "PARTIAL"
          ? "PARTIAL"
          : overdue
            ? "STALE"
            : "OK";

    rows.push({
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
    });
  }

  console.table(rows);
  const unhealthy = rows.filter((row) => row.verified === "yes" && row.health !== "OK");
  if (unhealthy.length) {
    console.error(`Verified stores requiring attention: ${unhealthy.map((row) => `${row.store}:${row.health}`).join(", ")}`);
    process.exitCode = 2;
  }
}

main().finally(() => prisma.$disconnect());
