import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CACHE_PATH = "data/geocoding-cache.json";
const endpoint = process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org/search";
const userAgent = process.env.GEOCODER_USER_AGENT?.trim();
const delayMs = Math.max(1000, Number(process.env.GEOCODER_DELAY_MS || 1100));

type CacheValue = { latitude: number; longitude: number } | null;
type Cache = Record<string, CacheValue>;

type SearchResult = { lat?: string; lon?: string; display_name?: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCache(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as Cache;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

function cacheKey(address: string, city: string) {
  return `${address.trim()}|${city.trim()}|Moldova`.toLocaleLowerCase();
}

async function geocode(address: string, city: string): Promise<CacheValue> {
  const url = new URL(endpoint);
  url.searchParams.set("q", `${address}, ${city}, Moldova`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "md");
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent!,
      "Accept-Language": "ro,ru;q=0.9,en;q=0.7",
    },
  });
  if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}`);
  const results = await response.json() as SearchResult[];
  const first = results[0];
  const latitude = Number(first?.lat);
  const longitude = Number(first?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 45.4 || latitude > 48.5 || longitude < 26.4 || longitude > 30.6) return null;
  return { latitude, longitude };
}

async function main() {
  if (!userAgent) {
    throw new Error("Set GEOCODER_USER_AGENT to an identifiable application/contact string before geocoding.");
  }
  const cache = loadCache();
  const locations = await prisma.storeLocation.findMany({
    where: {
      active: true,
      address: { not: null },
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: { id: true, storeId: true, name: true, address: true, city: true },
    orderBy: { id: "asc" },
  });

  let updated = 0;
  let misses = 0;
  for (const location of locations) {
    const address = location.address?.trim();
    if (!address) continue; // Never turn city-only placeholders into fake exact branches.
    const key = cacheKey(address, location.city);
    let coordinates: CacheValue;
    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      coordinates = cache[key];
    } else {
      coordinates = await geocode(address, location.city);
      cache[key] = coordinates;
      saveCache(cache);
      await sleep(delayMs);
    }
    if (!coordinates) {
      misses += 1;
      console.warn(`[GEOCODE MISS] ${location.name}: ${address}, ${location.city}`);
      continue;
    }
    await prisma.storeLocation.update({
      where: { id: location.id },
      data: coordinates,
    });
    updated += 1;
    console.log(`[GEOCODED] ${location.name}: ${coordinates.latitude}, ${coordinates.longitude}`);
  }

  console.log(`Geocoding complete: updated=${updated}, misses=${misses}, candidates=${locations.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
