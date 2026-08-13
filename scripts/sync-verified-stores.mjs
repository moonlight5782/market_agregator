import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const DEFAULT_STATUSES = ["VERIFIED"];
const VALID_STATUSES = new Set(["DISCOVERED", "UNVERIFIED", "PARTIAL", "BLOCKED", "VERIFIED"]);

export function argValue(args, name, fallback) {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1];
  return fallback;
}

export function parseCsv(value, fallback = []) {
  const values = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

export function parsePositiveInteger(value, label, { minimum = 1, maximum = 16 } = {}) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

export function statusSummary(registry) {
  return registry.reduce((summary, store) => {
    summary[store.status] = (summary[store.status] ?? 0) + 1;
    return summary;
  }, {});
}

export function selectEligibleStores(registry, { statuses = DEFAULT_STATUSES, slugs = [] } = {}) {
  const requestedStatuses = new Set(statuses.map((status) => status.toUpperCase()));
  const requestedSlugs = new Set(slugs);
  const unknownStatuses = [...requestedStatuses].filter((status) => !VALID_STATUSES.has(status));
  if (unknownStatuses.length) {
    throw new Error(`Unsupported registry status: ${unknownStatuses.join(", ")}.`);
  }
  return registry.filter((store) => (
    requestedStatuses.has(store.status)
    && (requestedSlugs.size === 0 || requestedSlugs.has(store.slug))
  ));
}

function runSync(store, { limit, browserThreshold }) {
  return new Promise((resolveRun) => {
    console.log(`\n===== SYNC ${store.slug} (${store.name}) =====`);
    const child = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "data:sync", "--", `--store=${store.slug}`, `--limit=${limit}`, `--browser-threshold=${browserThreshold}`],
      { stdio: "inherit", env: process.env },
    );
    child.once("error", (error) => resolveRun({ store: store.slug, exitCode: 1, error: error.message }));
    child.once("close", (exitCode) => resolveRun({ store: store.slug, exitCode: exitCode ?? 1 }));
  });
}

async function runPool(stores, concurrency, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, stores.length) }, async () => {
    while (nextIndex < stores.length) {
      const store = stores[nextIndex++];
      await worker(store);
    }
  });
  await Promise.all(workers);
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const limit = parsePositiveInteger(argValue(args, "limit", "500"), "limit", { minimum: 1, maximum: 100000 });
  const concurrency = parsePositiveInteger(argValue(args, "concurrency", "1"), "concurrency", { minimum: 1, maximum: 4 });
  const browserThreshold = Number(argValue(args, "browser-threshold", "0.8"));
  if (!Number.isFinite(browserThreshold) || browserThreshold <= 0 || browserThreshold > 1) {
    throw new Error("browser-threshold must be greater than 0 and no greater than 1.");
  }

  const statuses = parseCsv(argValue(args, "statuses", DEFAULT_STATUSES.join(",")), DEFAULT_STATUSES)
    .map((status) => status.toUpperCase());
  const slugs = parseCsv(argValue(args, "stores", ""));
  const allowEmpty = args.includes("--allow-empty");
  const registryPath = resolve(argValue(args, "registry", env.STORE_REGISTRY_PATH || "data/store-registry.json"));
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));
  const stores = selectEligibleStores(registry, { statuses, slugs });

  console.log(`Selected statuses: ${statuses.join(", ")}; selected stores: ${slugs.join(", ") || "all"}; concurrency: ${concurrency}.`);
  if (stores.length === 0) {
    const summary = Object.entries(statusSummary(registry)).map(([status, count]) => `${status}=${count}`).join(", ") || "empty registry";
    const message = `No eligible stores found. Registry status summary: ${summary}.`;
    if (allowEmpty) {
      console.warn(`[SYNC SKIPPED] ${message}`);
      return { successes: [], partials: [], failures: [], skipped: true };
    }
    throw new Error(`${message} Refusing to report a successful synchronization with no work performed.`);
  }

  const successes = [];
  const partials = [];
  const failures = [];
  await runPool(stores, concurrency, async (store) => {
    const result = await runSync(store, { limit, browserThreshold });
    if (result.exitCode === 0) successes.push(store.slug);
    else if (result.exitCode === 2) partials.push(store.slug);
    else failures.push(result);
  });

  console.log("\n===== VERIFIED STORE SYNC SUMMARY =====");
  console.log(`Successful (${successes.length}): ${successes.join(", ") || "none"}`);
  console.log(`Partial (${partials.length}): ${partials.join(", ") || "none"}`);
  console.log(`Failed (${failures.length}): ${failures.map((item) => `${item.store}:${item.exitCode}`).join(", ") || "none"}`);

  if (failures.length) process.exitCode = 1;
  else if (partials.length) process.exitCode = 2;
  return { successes, partials, failures, skipped: false };
}

const isDirectExecution = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  main().catch((error) => {
    console.error(`[SYNC CONFIGURATION ERROR] ${error.message}`);
    process.exitCode = 1;
  });
}
