export type DemoStore = {
  id: string;
  name: string;
  slug: string;
  city: string;
};

export type DemoOffer = {
  id: string;
  store: DemoStore;
  price: number;
  oldPrice?: number;
  currency: "MDL";
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  quantity?: number;
  externalUrl: string;
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
};

export const demoStores: DemoStore[] = [
  { id: "enter", name: "Enter", slug: "enter", city: "Chișinău" },
  { id: "darwin", name: "Darwin", slug: "darwin", city: "Chișinău" },
  { id: "maximum", name: "Maximum", slug: "maximum", city: "Chișinău" },
  { id: "linella", name: "Linella", slug: "linella", city: "Chișinău" },
  { id: "metro", name: "METRO", slug: "metro", city: "Chișinău" },
  { id: "supraten", name: "Supraten", slug: "supraten", city: "Chișinău" },
];

export const demoCategories = [
  { slug: "electronics", nameRu: "Электроника" },
  { slug: "groceries", nameRu: "Продукты" },
  { slug: "home", nameRu: "Дом и быт" },
  { slug: "construction", nameRu: "Строительство" },
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
      { id: "o1", store: demoStores[0], price: 16999, oldPrice: 17999, currency: "MDL", stockStatus: "IN_STOCK", quantity: 8, externalUrl: "https://enter.online/" },
      { id: "o2", store: demoStores[1], price: 17499, currency: "MDL", stockStatus: "IN_STOCK", quantity: 5, externalUrl: "https://darwin.md/" },
      { id: "o3", store: demoStores[2], price: 17999, currency: "MDL", stockStatus: "LOW_STOCK", quantity: 2, externalUrl: "https://maximum.md/" },
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
      { id: "o4", store: demoStores[1], price: 14999, oldPrice: 15999, currency: "MDL", stockStatus: "IN_STOCK", quantity: 6, externalUrl: "https://darwin.md/" },
      { id: "o5", store: demoStores[0], price: 15249, currency: "MDL", stockStatus: "IN_STOCK", quantity: 3, externalUrl: "https://enter.online/" },
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
      { id: "o6", store: demoStores[3], price: 28.49, oldPrice: 31.99, currency: "MDL", stockStatus: "IN_STOCK", quantity: 30, externalUrl: "https://linella.md/" },
      { id: "o7", store: demoStores[4], price: 29.95, currency: "MDL", stockStatus: "IN_STOCK", quantity: 54, externalUrl: "https://metro.zakaz.md/" },
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
      { id: "o8", store: demoStores[4], price: 279.9, oldPrice: 319.9, currency: "MDL", stockStatus: "IN_STOCK", quantity: 14, externalUrl: "https://metro.zakaz.md/" },
      { id: "o9", store: demoStores[3], price: 289.99, currency: "MDL", stockStatus: "IN_STOCK", quantity: 9, externalUrl: "https://linella.md/" },
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
      { id: "o10", store: demoStores[5], price: 1499, oldPrice: 1699, currency: "MDL", stockStatus: "IN_STOCK", quantity: 4, externalUrl: "https://supraten.md/" },
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
      { id: "o11", store: demoStores[2], price: 2499, currency: "MDL", stockStatus: "IN_STOCK", quantity: 7, externalUrl: "https://maximum.md/" },
      { id: "o12", store: demoStores[0], price: 2599, currency: "MDL", stockStatus: "UNKNOWN", externalUrl: "https://enter.online/" },
    ],
  },
];

export function getBestOffer(product: DemoProduct) {
  return [...product.offers].sort((a, b) => a.price - b.price)[0];
}
