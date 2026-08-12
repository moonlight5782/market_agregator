import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const limit = argValue("limit", "500");
const threshold = argValue("browser-threshold", "0.8");
const registry = JSON.parse(readFileSync("data/store-registry.json", "utf8"));
const stores = registry.filter((store) => store.status === "VERIFIED");

const successes = [];
const failures = [];

for (const store of stores) {
  console.log(`\n===== SYNC ${store.slug} (${store.name}) =====`);
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "data:sync", "--", `--store=${store.slug}`, `--limit=${limit}`, `--browser-threshold=${threshold}`],
    { stdio: "inherit", env: process.env }
  );
  if (result.status === 0) successes.push(store.slug);
  else failures.push({ store: store.slug, exitCode: result.status ?? 1 });
}

console.log("\n===== VERIFIED STORE SYNC SUMMARY =====");
console.log(`Successful (${successes.length}): ${successes.join(", ") || "none"}`);
console.log(`Failed (${failures.length}): ${failures.map((item) => `${item.store}:${item.exitCode}`).join(", ") || "none"}`);

if (failures.length) process.exitCode = 1;
