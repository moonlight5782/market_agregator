import { existsSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Prisma, PrismaClient, ScraperRunStatus } from "@prisma/client";

const prisma = new PrismaClient();

type CrawlReport = {
  outcome?: string;
  publish_readiness?: { ready?: boolean; blockers?: string[] };
  quality?: { unique_products?: number; errors?: number; [key: string]: unknown };
  [key: string]: unknown;
};

type ImportSummary = { imported: number; failed: number; total: number };

function argValue(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

async function finishRun(
  runId: string,
  storeId: string,
  status: ScraperRunStatus,
  report: CrawlReport | null,
  importSummary: ImportSummary | null,
  errorMessage?: string,
) {
  const now = new Date();
  const productsFound = Number(report?.quality?.unique_products ?? 0);
  const crawlErrors = Number(report?.quality?.errors ?? 0);
  const importErrors = Number(importSummary?.failed ?? 0);
  const lastError = errorMessage || (crawlErrors + importErrors > 0 ? `${crawlErrors + importErrors} crawl/import error(s)` : null);

  await prisma.$transaction([
    prisma.scraperRun.update({
      where: { id: runId },
      data: {
        status,
        finishedAt: now,
        productsFound,
        productsImported: importSummary?.imported ?? 0,
        errors: crawlErrors + importErrors,
        reportPath: report ? `data/reports/${argValue("store")}.json` : null,
        errorMessage: lastError,
        metrics: report ? (report as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    }),
    prisma.storeSource.updateMany({
      where: { storeId, enabled: true },
      data: {
        lastCrawl: now,
        ...(status === ScraperRunStatus.SUCCESS ? { lastSuccess: now, lastError: null } : { lastError: lastError ?? status }),
      },
    }),
  ]);
}

async function main() {
  const storeSlug = argValue("store");
  const limit = argValue("limit", "0")!;
  const browserThreshold = argValue("browser-threshold", "0.8")!;
  if (!storeSlug) throw new Error("Usage: npm run data:sync -- --store=darwin [--limit=0] [--browser-threshold=0.8]. limit=0 means full uncapped crawl.");

  const store = await prisma.store.findUnique({ where: { slug: storeSlug }, select: { id: true, name: true } });
  if (!store) throw new Error(`Store '${storeSlug}' is missing from DB. Run npm run db:seed first.`);

  const run = await prisma.scraperRun.create({ data: { storeId: store.id, status: ScraperRunStatus.RUNNING } });
  const reportPath = `data/reports/${storeSlug}.json`;
  const rawPath = `data/raw/${storeSlug}.ndjson`;
  const importSummaryPath = `data/reports/${storeSlug}-import.json`;
  if (existsSync(importSummaryPath)) rmSync(importSummaryPath);

  console.log(`[SYNC] ${store.name} (${storeSlug}) run=${run.id}`);
  const python = process.env.PYTHON_BIN || "python";
  const crawl = spawnSync(
    python,
    ["-m", "services.scraper.run", "--store", storeSlug, "--limit", limit, "--browser-threshold", browserThreshold],
    { stdio: "inherit", env: process.env },
  );
  const report = readJson<CrawlReport>(reportPath);

  if (crawl.status === 2 || report?.outcome === "PARTIAL" || report?.publish_readiness?.ready === false) {
    const blockers = report?.publish_readiness?.blockers?.join(", ") || "coverage/quality requirements not met";
    await finishRun(run.id, store.id, ScraperRunStatus.PARTIAL, report, null, blockers);
    console.error(`[SYNC PARTIAL] ${storeSlug}: not imported because publish readiness failed: ${blockers}`);
    process.exitCode = 2;
    return;
  }

  if (crawl.status !== 0) {
    await finishRun(run.id, store.id, ScraperRunStatus.FAILED, report, null, `Crawler exit code ${crawl.status ?? 1}`);
    process.exitCode = crawl.status ?? 1;
    return;
  }
  if (!report?.publish_readiness?.ready) {
    await finishRun(run.id, store.id, ScraperRunStatus.PARTIAL, report, null, "Crawler did not provide positive publish readiness evidence");
    process.exitCode = 2;
    return;
  }
  if (!existsSync(rawPath)) {
    await finishRun(run.id, store.id, ScraperRunStatus.FAILED, report, null, `Crawler did not create ${rawPath}`);
    process.exitCode = 3;
    return;
  }

  const importer = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsx", "scripts/import-raw.ts", rawPath],
    { stdio: "inherit", env: { ...process.env, IMPORT_SUMMARY_PATH: importSummaryPath } },
  );
  const importSummary = readJson<ImportSummary>(importSummaryPath);

  if (importer.status === 0 && importSummary && importSummary.failed === 0 && importSummary.imported === importSummary.total) {
    await finishRun(run.id, store.id, ScraperRunStatus.SUCCESS, report, importSummary);
    console.log(`[SYNC SUCCESS] ${storeSlug}: found=${report?.quality?.unique_products ?? 0}, imported=${importSummary.imported}`);
    return;
  }

  if ((importSummary?.imported ?? 0) > 0) {
    await finishRun(run.id, store.id, ScraperRunStatus.PARTIAL, report, importSummary, `${importSummary?.failed ?? 0} row(s) failed to import`);
    console.error(`[SYNC PARTIAL] ${storeSlug}: imported=${importSummary?.imported ?? 0}, failed=${importSummary?.failed ?? 0}`);
    process.exitCode = 2;
    return;
  }

  await finishRun(run.id, store.id, ScraperRunStatus.FAILED, report, importSummary, `Importer exit code ${importer.status ?? 1}`);
  process.exitCode = importer.status ?? 1;
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
