import crocoSnapshot from "../data/croco-products.json";
import { WEEKDAYS, type OpeningHours, type StoreHours } from "./opening-hours";

export type DemoStore = {
  id: string;
  name: string;
  slug: string;
  city: string;
  openingHours?: StoreHours | null;
  latitude?: number;
  longitude?: number;
  address?: string;
  websiteUrl?: string;
};

const officialStoreUrls: Record<string, string> = {
  "cip-market": "https://www.cipmarket.md/ru/",
  "metro": "https://www.metro.md/",
  "linella": "https://linella.md/ru/home",
  "kaufland": "https://www.kaufland.md/ru/",
  "nr1": "https://nr1.md/ru/",
  "alcomarket": "https://alcomarket.md/ru",
  "local-discounter": "https://mylocal.md/ru/",
  "rogob": "https://rogob.md/",
  "jysk": "https://jysk.md/",
  "maximum": "https://maximum.md/",
  "ocean-fish": "https://oceanfish.md/",
  "drinkstock": "https://drinkstock.md/",
};

export function getOfficialStoreUrl(store: Pick<DemoStore, "slug" | "websiteUrl">) {
  return store.websiteUrl ?? officialStoreUrls[store.slug] ?? null;
}

export type DemoOffer = {
  id: string;
  store: DemoStore;
  price: number;
  oldPrice?: number;
  currency: "MDL";
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  quantity?: number;
  externalUrl: string;
  sourceName?: string;
  sourceUrl?: string;
  validFrom?: string | null;
  validUntil?: string | null;
  catalogPage?: number | null;
};

export type DemoProduct = {
  id: string;
  slug: string;
  title: string;
  brand?: string;
  categorySlug: string;
  categoryName: string;
  imageUrl: string;
  offers: DemoOffer[];
  aliases?: string[];
};

function comparisonKey(product: DemoProduct) {
  const normalizedTitle = product.title
    .toLocaleLowerCase("ru")
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
  return `${product.categorySlug}:${normalizedTitle}`;
}

export function consolidateDemoProducts(products: DemoProduct[]) {
  const groups = new Map<string, DemoProduct>();
  for (const product of products) {
    const key = comparisonKey(product);
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { ...product, offers: [...product.offers], aliases: [...(product.aliases ?? [])] });
      continue;
    }
    const knownOfferIds = new Set(current.offers.map((offer) => offer.id));
    current.offers.push(...product.offers.filter((offer) => !knownOfferIds.has(offer.id)));
    current.aliases = [...new Set([...(current.aliases ?? []), product.slug, ...(product.aliases ?? [])])];
  }
  return [...groups.values()];
}

function everyDay(open: string, close: string): OpeningHours {
  return {
    version: 1,
    timezone: "Europe/Chisinau",
    weekly: Object.fromEntries(WEEKDAYS.map((day) => [day, [{ open, close }]])),
  };
}

function weeklySchedule(weekdays: [string, string], saturday: [string, string], sunday: [string, string]): OpeningHours {
  return {
    version: 1,
    timezone: "Europe/Chisinau",
    weekly: Object.fromEntries(WEEKDAYS.map((day) => {
      const [open, close] = day === "sat" ? saturday : day === "sun" ? sunday : weekdays;
      return [day, [{ open, close }]];
    })),
  };
}

export const demoStores: DemoStore[] = [
  { id: "enter", name: "Enter", slug: "enter", city: "Chișinău", address: "bd. Ștefan cel Mare", latitude: 47.0247, longitude: 28.8322, openingHours: everyDay("09:00", "20:00") },
  { id: "darwin", name: "Darwin", slug: "darwin", city: "Chișinău", address: "str. Arborilor", latitude: 47.0105, longitude: 28.8352, openingHours: everyDay("09:00", "20:00") },
  { id: "maximum", name: "Maximum", slug: "maximum", city: "Chișinău", address: "str. Ion Creangă", latitude: 47.0397, longitude: 28.8038, openingHours: weeklySchedule(["09:00", "20:00"], ["09:00", "20:00"], ["09:00", "19:00"]) },
  { id: "linella", name: "Linella", slug: "linella", city: "Chișinău", address: "str. Independenței", latitude: 46.9918, longitude: 28.8592, openingHours: everyDay("08:00", "22:00") },
  { id: "metro", name: "METRO", slug: "metro", city: "Chișinău", address: "bd. Dacia", latitude: 46.9759, longitude: 28.8868, openingHours: everyDay("08:00", "21:00") },
  { id: "supraten", name: "Supraten", slug: "supraten", city: "Chișinău", address: "str. Petricani 84", latitude: 47.0587, longitude: 28.8372, openingHours: weeklySchedule(["08:00", "19:00"], ["08:00", "17:00"], ["10:00", "15:00"]) },
];

export const demoCategories = [
  { slug: "electronics", nameRu: "Электроника" },
  { slug: "groceries", nameRu: "Продукты" },
  { slug: "home", nameRu: "Дом и быт" },
  { slug: "construction", nameRu: "Строительство" },
  { slug: "beauty", nameRu: "Красота и уход" },
  { slug: "pets", nameRu: "Зоотовары" },
  { slug: "baby", nameRu: "Детские товары" },
  { slug: "produce", nameRu: "Овощи и фрукты" },
  { slug: "meat-fish", nameRu: "Мясо и рыба" },
  { slug: "dairy", nameRu: "Молочные продукты" },
  { slug: "drinks", nameRu: "Напитки" },
  { slug: "alcohol", nameRu: "Алкоголь" },
  { slug: "sweets", nameRu: "Сладости" },
];

export const demoProducts: DemoProduct[] = [
  {
    id: "iphone-16-128",
    slug: "apple-iphone-16-128gb",
    title: "Apple iPhone 16 128GB",
    brand: "Apple",
    categorySlug: "electronics",
    categoryName: "Электроника",
    imageUrl: "https://images.unsplash.com/photo-1592286927505-1def25115558?auto=format&fit=crop&w=900&q=80",
    offers: [
      { id: "o1", store: demoStores[0], price: 16999, oldPrice: 17999, currency: "MDL", stockStatus: "IN_STOCK", quantity: 8, externalUrl: "https://enter.online/search?query=Apple%20iPhone%2016%20128GB" },
      { id: "o2", store: demoStores[1], price: 17499, currency: "MDL", stockStatus: "IN_STOCK", quantity: 5, externalUrl: "https://darwin.md/ru/search?q=Apple%20iPhone%2016%20128GB" },
      { id: "o3", store: demoStores[2], price: 17999, currency: "MDL", stockStatus: "LOW_STOCK", quantity: 2, externalUrl: "https://maximum.md/ru/search?query=Apple%20iPhone%2016%20128GB" },
    ],
  },
  {
    id: "galaxy-s25",
    slug: "samsung-galaxy-s25-256gb",
    title: "Samsung Galaxy S25 256GB",
    brand: "Samsung",
    categorySlug: "electronics",
    categoryName: "Электроника",
    imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=900&q=80",
    offers: [
      { id: "o4", store: demoStores[1], price: 14999, oldPrice: 15999, currency: "MDL", stockStatus: "IN_STOCK", quantity: 6, externalUrl: "https://darwin.md/ru/search?q=Samsung%20Galaxy%20S25%20256GB" },
      { id: "o5", store: demoStores[0], price: 15249, currency: "MDL", stockStatus: "IN_STOCK", quantity: 3, externalUrl: "https://enter.online/search?query=Samsung%20Galaxy%20S25%20256GB" },
    ],
  },
  {
    id: "cola-2l",
    slug: "coca-cola-2l",
    title: "Coca-Cola 2L",
    brand: "Coca-Cola",
    categorySlug: "groceries",
    categoryName: "Продукты",
    imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80",
    offers: [
      { id: "o6", store: demoStores[3], price: 28.49, oldPrice: 31.99, currency: "MDL", stockStatus: "IN_STOCK", quantity: 30, externalUrl: "https://linella.md/ro/catalog" },
      { id: "o7", store: demoStores[4], price: 29.95, currency: "MDL", stockStatus: "IN_STOCK", quantity: 54, externalUrl: "https://metro.zakaz.md/ru/search/?q=Coca-Cola%202L" },
    ],
  },
  {
    id: "coffee-lavazza",
    slug: "lavazza-crema-e-gusto-1kg",
    title: "Lavazza Crema e Gusto 1kg",
    brand: "Lavazza",
    categorySlug: "groceries",
    categoryName: "Продукты",
    imageUrl: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80",
    offers: [
      { id: "o8", store: demoStores[4], price: 279.9, oldPrice: 319.9, currency: "MDL", stockStatus: "IN_STOCK", quantity: 14, externalUrl: "https://metro.zakaz.md/ru/search/?q=Lavazza%20Crema%20e%20Gusto%201kg" },
      { id: "o9", store: demoStores[3], price: 289.99, currency: "MDL", stockStatus: "IN_STOCK", quantity: 9, externalUrl: "https://linella.md/ro/catalog" },
    ],
  },
  {
    id: "drill-bosch",
    slug: "bosch-gsb-13-re",
    title: "Дрель ударная Bosch GSB 13 RE",
    brand: "Bosch",
    categorySlug: "construction",
    categoryName: "Строительство",
    imageUrl: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80",
    offers: [
      { id: "o10", store: demoStores[5], price: 1499, oldPrice: 1699, currency: "MDL", stockStatus: "IN_STOCK", quantity: 4, externalUrl: "https://supraten.md/search?query=Bosch%20GSB%2013%20RE" },
    ],
  },
  {
    id: "vacuum",
    slug: "philips-powerpro-compact",
    title: "Пылесос Philips PowerPro Compact",
    brand: "Philips",
    categorySlug: "home",
    categoryName: "Дом и быт",
    imageUrl: "https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=900&q=80",
    offers: [
      { id: "o11", store: demoStores[2], price: 2499, currency: "MDL", stockStatus: "IN_STOCK", quantity: 7, externalUrl: "https://maximum.md/ru/search?query=Philips%20PowerPro%20Compact" },
      { id: "o12", store: demoStores[0], price: 2599, currency: "MDL", stockStatus: "UNKNOWN", externalUrl: "https://enter.online/search?query=Philips%20PowerPro%20Compact" },
    ],
  },
];

demoProducts.push(...consolidateDemoProducts(crocoSnapshot.products as unknown as DemoProduct[]));

export const allDemoStores = [...new Map(
  demoProducts.flatMap((product) => product.offers.map((offer) => offer.store)).map((store) => [store.slug, store]),
).values()];

export function getBestOffer(product: DemoProduct) {
  return [...product.offers].sort((a, b) => a.price - b.price)[0];
}
