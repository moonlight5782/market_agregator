export type Locale = "ru" | "ro";

export const defaultLocale: Locale = "ru";

export function normalizeLocale(value?: string | null): Locale {
  return value === "ro" ? "ro" : "ru";
}

export const dictionaries = {
  ru: {
    home: "Главная",
    search: "Поиск",
    find: "Найти",
    apply: "Применить",
    allMoldova: "Вся Молдова",
    city: "Город",
    store: "Магазин",
    allStores: "Все магазины",
    sortCheap: "Сначала дешевле",
    sortExpensive: "Сначала дороже",
    sortNearest: "Сначала ближайшие",
    searchPlaceholder: "Что вы ищете?",
    heroTitle: "Все товары Молдовы в одном поиске",
    heroText: "Сравнивайте цены, наличие и магазины. Выбирайте лучшее предложение рядом с вами.",
    heroPlaceholder: "Например: iPhone 16, Coca-Cola, Bosch...",
    stores: "магазинов",
    products: "товаров",
    offers: "предложений",
    categories: "Категории",
    popularOffers: "Популярные предложения",
    popularOffersText: "Одна карточка товара — предложения из нескольких магазинов.",
    noImage: "Нет изображения",
    noCategory: "Без категории",
    from: "от",
    offersShort: "предлож.",
    inStock: "в наличии",
    noOffers: "Предложений пока нет",
    compareOffers: "Сравнить предложения",
    searchAllProducts: "все товары",
    results: "результатов",
    demoData: "demo data",
    localStockUnknown: "филиал есть, локальный остаток не подтверждён",
    toStore: "В магазин ↗",
    openCompare: "Открыть карточку и сравнить →",
    nothingFound: "Ничего не найдено для выбранных условий.",
    categoryNotFound: "Категория не найдена.",
    bestPrice: "Лучшая цена",
    confirmedStock: "с подтверждённым наличием",
    noCurrentOffers: "Нет актуальных предложений",
    specifications: "Характеристики",
    storeOffers: "Предложения магазинов",
    offerExplanation: "Цена относится к предложению магазина, наличие — к конкретному филиалу, когда магазин его раскрывает.",
    availableInBranches: "Доступно в {available} из {total} проверенных филиалов",
    branchStockUnknown: "магазин присутствует, остаток филиала не подтверждён",
    outOfStock: "Нет в наличии",
    preorder: "Предзаказ",
    inStockExact: "В наличии · {quantity} шт.",
    inStockLabel: "В наличии",
    stockUnknown: "Наличие уточняется",
    itemsInCategory: "товаров",
    goodsInCity: "Товары в {city}",
    language: "Язык",
    useLocation: "Использовать моё местоположение",
    locating: "Определяем местоположение…",
    locationReady: "Местоположение выбрано",
    locationError: "Не удалось получить геолокацию",
    radius: "Радиус",
    nearestStore: "Ближайший магазин",
    distanceAway: "{distance} км",
    previousPage: "← Назад",
    nextPage: "Далее →",
    pageOf: "Страница {page} из {pages}",
  },
  ro: {
    home: "Acasă",
    search: "Căutare",
    find: "Caută",
    apply: "Aplică",
    allMoldova: "Toată Moldova",
    city: "Oraș",
    store: "Magazin",
    allStores: "Toate magazinele",
    sortCheap: "Mai întâi ieftine",
    sortExpensive: "Mai întâi scumpe",
    sortNearest: "Cele mai apropiate",
    searchPlaceholder: "Ce căutați?",
    heroTitle: "Toate produsele din Moldova într-o singură căutare",
    heroText: "Comparați prețurile, disponibilitatea și magazinele. Alegeți cea mai bună ofertă din apropiere.",
    heroPlaceholder: "De exemplu: iPhone 16, Coca-Cola, Bosch...",
    stores: "magazine",
    products: "produse",
    offers: "oferte",
    categories: "Categorii",
    popularOffers: "Oferte populare",
    popularOffersText: "Un singur produs — oferte de la mai multe magazine.",
    noImage: "Fără imagine",
    noCategory: "Fără categorie",
    from: "de la",
    offersShort: "oferte",
    inStock: "în stoc",
    noOffers: "Nu există încă oferte",
    compareOffers: "Compară ofertele",
    searchAllProducts: "toate produsele",
    results: "rezultate",
    demoData: "date demo",
    localStockUnknown: "magazinul există aici, stocul local nu este confirmat",
    toStore: "La magazin ↗",
    openCompare: "Deschide produsul și compară →",
    nothingFound: "Nu s-a găsit nimic pentru condițiile selectate.",
    categoryNotFound: "Categoria nu a fost găsită.",
    bestPrice: "Cel mai bun preț",
    confirmedStock: "cu stoc confirmat",
    noCurrentOffers: "Nu există oferte actuale",
    specifications: "Caracteristici",
    storeOffers: "Ofertele magazinelor",
    offerExplanation: "Prețul aparține ofertei magazinului, iar stocul — filialei concrete atunci când magazinul publică această informație.",
    availableInBranches: "Disponibil în {available} din {total} filiale verificate",
    branchStockUnknown: "magazinul este prezent, stocul filialei nu este confirmat",
    outOfStock: "Nu este în stoc",
    preorder: "Precomandă",
    inStockExact: "În stoc · {quantity} buc.",
    inStockLabel: "În stoc",
    stockUnknown: "Disponibilitatea se verifică",
    itemsInCategory: "produse",
    goodsInCity: "Produse în {city}",
    language: "Limba",
    useLocation: "Folosește locația mea",
    locating: "Determinăm locația…",
    locationReady: "Locația este selectată",
    locationError: "Nu am putut obține geolocația",
    radius: "Rază",
    nearestStore: "Cel mai apropiat magazin",
    distanceAway: "{distance} km",
    previousPage: "← Înapoi",
    nextPage: "Înainte →",
    pageOf: "Pagina {page} din {pages}",
  },
} as const;

type TranslationKey = keyof typeof dictionaries.ru;
export type Dictionary = Record<TranslationKey, string>;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function formatMessage(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}

export function numberLocale(locale: Locale) {
  return locale === "ro" ? "ro-RO" : "ru-RU";
}

export function stockLabel(status: string, quantity: number | null | undefined, locale: Locale) {
  const t = getDictionary(locale);
  if (status === "OUT_OF_STOCK" || quantity === 0) return t.outOfStock;
  if (status === "PREORDER") return t.preorder;
  if (quantity != null && quantity > 0 && quantity <= 10) return formatMessage(t.inStockExact, { quantity });
  if (status === "IN_STOCK" || status === "LOW_STOCK" || (quantity != null && quantity > 10)) return t.inStockLabel;
  return t.stockUnknown;
}

const demoCategoryNames: Record<string, Record<Locale, string>> = {
  electronics: { ru: "Электроника", ro: "Electronice" },
  groceries: { ru: "Продукты", ro: "Produse alimentare" },
  home: { ru: "Дом и быт", ro: "Casă și uz casnic" },
  construction: { ru: "Строительство", ro: "Construcții" },
};

export function demoCategoryName(slug: string, locale: Locale, fallback?: string | null) {
  return demoCategoryNames[slug]?.[locale] ?? fallback ?? slug;
}
