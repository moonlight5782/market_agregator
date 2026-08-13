import { readFileSync } from "node:fs";

const registry = JSON.parse(readFileSync("data/store-registry.json", "utf8"));
const allowedStatuses = new Set(["DISCOVERED", "UNVERIFIED", "PARTIAL", "BLOCKED", "VERIFIED"]);
const evidenceRequiredStatuses = new Set(["UNVERIFIED", "PARTIAL", "BLOCKED"]);
const seenSlugs = new Set();
const seenDomains = new Set();
const errors = [];

if (!Array.isArray(registry)) {
  errors.push("Store registry must be a JSON array.");
} else {
  for (const [index, store] of registry.entries()) {
    const prefix = `store[${index}]`;
    if (!store || typeof store !== "object") {
      errors.push(`${prefix} must be an object.`);
      continue;
    }

    for (const field of ["slug", "name", "domain", "status", "source"]) {
      if (typeof store[field] !== "string" || !store[field].trim()) {
        errors.push(`${prefix}.${field} must be a non-empty string.`);
      }
    }

    if (typeof store.slug === "string") {
      if (seenSlugs.has(store.slug)) errors.push(`Duplicate store slug: ${store.slug}`);
      seenSlugs.add(store.slug);
    }

    if (typeof store.domain === "string") {
      try {
        const url = new URL(store.domain);
        if (!/^https?:$/.test(url.protocol)) errors.push(`${store.slug}: domain must use http/https.`);
        const normalizedDomain = `${url.protocol}//${url.host}`.toLowerCase();
        if (seenDomains.has(normalizedDomain)) errors.push(`Duplicate store domain: ${normalizedDomain}`);
        seenDomains.add(normalizedDomain);
      } catch {
        errors.push(`${store.slug ?? prefix}: invalid domain URL.`);
      }
    }

    if (!Array.isArray(store.categories) || store.categories.length === 0 || store.categories.some((value) => typeof value !== "string" || !value.trim())) {
      errors.push(`${store.slug ?? prefix}: categories must be a non-empty string array.`);
    }

    if (!allowedStatuses.has(store.status)) {
      errors.push(`${store.slug ?? prefix}: unsupported status ${JSON.stringify(store.status)}.`);
    }

    if (store.physicalLocationStockRequired !== undefined && typeof store.physicalLocationStockRequired !== "boolean") {
      errors.push(`${store.slug ?? prefix}: physicalLocationStockRequired must be boolean when provided.`);
    }

    if (evidenceRequiredStatuses.has(store.status) && (typeof store.statusReason !== "string" || !store.statusReason.trim())) {
      errors.push(`${store.slug ?? prefix}: ${store.status} requires statusReason.`);
    }

    if (store.status === "VERIFIED") {
      if (typeof store.verifiedAt !== "string" || Number.isNaN(Date.parse(store.verifiedAt))) {
        errors.push(`${store.slug ?? prefix}: VERIFIED requires a valid verifiedAt timestamp.`);
      }
      if (typeof store.coverageReport !== "string" || !store.coverageReport.trim()) {
        errors.push(`${store.slug ?? prefix}: VERIFIED requires coverageReport evidence.`);
      }
      if (store.physicalLocationStockRequired === true && (typeof store.locationCoverageReport !== "string" || !store.locationCoverageReport.trim())) {
        errors.push(`${store.slug ?? prefix}: VERIFIED physical chain requires locationCoverageReport evidence.`);
      }
    }
  }
}

if (errors.length) {
  console.error("Store registry validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const counts = registry.reduce((acc, store) => {
  acc[store.status] = (acc[store.status] ?? 0) + 1;
  return acc;
}, {});
console.log(`Store registry OK (${registry.length} stores): ${Object.entries(counts).map(([status, count]) => `${status}=${count}`).join(", ")}`);
