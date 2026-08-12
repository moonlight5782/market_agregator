import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const store = argValue("store");
const limit = argValue("limit", "500");
const browserThreshold = argValue("browser-threshold", "0.8");

if (!store) {
  console.error("Usage: npm run data:sync -- --store=darwin [--limit=500] [--browser-threshold=0.8]");
  process.exit(2);
}

const python = process.env.PYTHON_BIN || "python";
const crawl = spawnSync(
  python,
  ["-m", "services.scraper.run", "--store", store, "--limit", limit, "--browser-threshold", browserThreshold],
  { stdio: "inherit", env: process.env }
);
if (crawl.status !== 0) process.exit(crawl.status ?? 1);

const rawFile = `data/raw/${store}.ndjson`;
if (!existsSync(rawFile)) {
  console.error(`Crawler finished but ${rawFile} was not created.`);
  process.exit(3);
}

const importer = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", "scripts/import-raw.ts", rawFile],
  { stdio: "inherit", env: process.env }
);
if (importer.status !== 0) process.exit(importer.status ?? 1);

console.log(`Store sync completed: ${store}`);
