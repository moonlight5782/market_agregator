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
    sortCheap: "Сначала дешевле",
    sortExpensive: "Сначала дороже",
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
  },
  ro: {
    home: "Acasă",
    search: "Căutare",
    find: "Caută",
    apply: "Aplică",
    allMoldova: "Toată Moldova",
    city: "Oraș",
    sortCheap: "Mai întâi ieftine",
    sortExpensive: "Mai întâi scumpe",
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
  },
} as const;

export type Dictionary = typeof dictionaries.ru;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] as Dictionary;
}

export function formatMessage(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
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
