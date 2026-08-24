import LocationFilter from "../../components/LocationFilter";
import StoreHours from "../../components/StoreHours";
import { getAvailableBrands, getAvailableCities, getAvailableStores, searchCatalog } from "../../lib/catalog-data";
import { getLocale } from "../../lib/get-locale";
import { demoCategoryName, formatMessage, getDictionary, numberLocale, stockLabel } from "../../lib/i18n";

type SearchParams = {
  q?: string; sort?: string; city?: string; store?: string; lat?: string; lon?: string;
  radius?: string; brand?: string; minPrice?: string; maxPrice?: string; page?: string;
};

function pageHref(params: SearchParams, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, page: String(page) })) if (value) query.set(key, value);
  return `/search?${query.toString()}`;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, locale] = await Promise.all([searchParams, getLocale()]);
  const { q = "", sort = "price-asc", city = "", store = "", lat = "", lon = "", radius = "10", brand = "", minPrice = "", maxPrice = "" } = params;
  const t = getDictionary(locale);
  const [result, cities, stores, brands] = await Promise.all([searchCatalog(params), getAvailableCities(), getAvailableStores(), getAvailableBrands()]);
  const hasFilters = Boolean(city || store || brand || minPrice || maxPrice || lat || lon);

  return (
    <main className="page-shell search-page">
      <div className="search-page__heading">
        <div><p className="eyebrow">{t.catalog}</p><h1>{q || t.searchAllProducts}</h1><p>{result.total} {t.results}{city ? ` · ${city}` : ""}{result.mode === "demo" ? ` · ${t.demoData}` : ""}</p></div>
      </div>

      <nav className="store-filter-strip" aria-label={t.store}>
        <Link href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), ...(sort ? { sort } : {}) }).toString()}`} className={!store ? "is-active" : ""}>{t.allStores}</Link>
        {stores.map((item) => {
          const next = new URLSearchParams();
          if (q) next.set("q", q);
          if (sort) next.set("sort", sort);
          next.set("store", item.slug);
          return <Link key={item.slug} href={`/search?${next.toString()}`} className={store === item.slug ? "is-active" : ""}>{item.name}</Link>;
        })}
      </nav>

      <form className="catalog-controls">
        <div className="catalog-search">
          <label className="search-input-wrap"><span aria-hidden="true">⌕</span><input name="q" defaultValue={q} placeholder={t.searchPlaceholder} /></label>
          <button className="button button--primary">{t.find}</button>
        </div>
        <details className="filter-panel" open={hasFilters}>
          <summary><span>☷ {t.filters}</span>{hasFilters && <span className="filter-dot" aria-label={t.filters} />}</summary>
          <div className="filter-grid">
            <label><span>{t.city}</span><select name="city" defaultValue={city}><option value="">{t.allMoldova}</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label><span>{t.store}</span><select name="store" defaultValue={store}><option value="">{t.allStores}</option>{stores.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
            <label><span>{t.brandLabel}</span><select name="brand" defaultValue={brand}><option value="">{t.allBrands}</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <fieldset className="price-fields"><legend>{t.price}</legend><input name="minPrice" inputMode="decimal" defaultValue={minPrice} placeholder={t.priceFrom} aria-label={t.priceFrom} /><input name="maxPrice" inputMode="decimal" defaultValue={maxPrice} placeholder={t.priceTo} aria-label={t.priceTo} /></fieldset>
            <label><span>{t.search}</span><select name="sort" defaultValue={sort}><option value="price-asc">{t.sortCheap}</option><option value="price-desc">{t.sortExpensive}</option><option value="nearest" disabled={!lat || !lon}>{t.sortNearest}</option></select></label>
            <LocationFilter latitude={lat} longitude={lon} radius={radius} labels={{ useLocation: t.useLocation, locating: t.locating, locationReady: t.locationReady, locationError: t.locationError, clearLocation: t.clearLocation, radius: t.radius }} />
          </div>
          <div className="filter-actions"><Link href={`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`}>{t.resetFilters}</Link><button className="button button--primary">{t.apply}</button></div>
        </details>
      </form>

      <div className="search-results">
        {result.products.map((product: any) => {
          const offers = product.offers;
          const best = [...offers].sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
          const imageUrl = product.imageUrl || best?.imageUrl;
          const category = result.mode === "demo" ? demoCategoryName(product.categorySlug, locale, product.categoryName) : (locale === "ro" ? product.category?.nameRo || product.category?.nameRu : product.category?.nameRu);
          const brandName = result.mode === "demo" ? product.brand : product.brand?.name;
          const productQuery = new URLSearchParams();
          if (city) productQuery.set("city", city);
          if (lat && lon) { productQuery.set("lat", lat); productQuery.set("lon", lon); productQuery.set("radius", radius); }
          const productUrl = `/product/${product.slug}${productQuery.size ? `?${productQuery.toString()}` : ""}`;
          return (
            <article key={product.id} className="search-result">
              <Link href={productUrl} className="search-result__image">{imageUrl ? <img src={imageUrl} alt={product.title} /> : <span>{t.noImage}</span>}</Link>
              <div className="search-result__content">
                <div className="product-kicker">{category ?? t.noCategory}{brandName ? ` · ${brandName}` : ""}</div>
                <h2><Link href={productUrl}>{product.title}</Link></h2>
                {best && <div className="search-result__best"><span>{t.from}</span><strong>{Number(best.price).toLocaleString(numberLocale(locale))} {best.currency}</strong><small>{offers.length} {t.offersShort}</small></div>}
                <div className="mini-offers">
                  {offers.slice(0, 3).map((offer: any) => {
                    const branch = offer.availabilities?.[0];
                    const location = offer.nearestLocation ?? branch?.location ?? offer.location;
                    const status = branch?.stockStatus ?? offer.stockStatus;
                    const quantity = branch?.quantity ?? offer.quantity;
                    return <div key={offer.id} className="mini-offer"><div><b>{offer.store.name}</b>{location && <small>{location.city}{location.address ? ` · ${location.address}` : ""}</small>}<StoreHours openingHours={location?.openingHours ?? (result.mode === "demo" ? offer.store.openingHours : null)} locale={locale} t={t} />{offer.distanceKm != null && <small>{formatMessage(t.distanceAway, { distance: Number(offer.distanceKm).toFixed(1) })}</small>}</div><span className="stock-label">{stockLabel(status, quantity, locale)}</span><strong>{Number(offer.price).toLocaleString(numberLocale(locale))} {offer.currency}</strong></div>;
                  })}
                </div>
                <Link href={productUrl} className="text-link">{t.openCompare}</Link>
              </div>
            </article>
          );
        })}
        {result.products.length === 0 && <div className="empty-state"><span aria-hidden="true">⌕</span><h2>{t.nothingFound}</h2><Link href="/search">{t.resetFilters}</Link></div>}
      </div>

      {result.totalPages > 1 && <nav className="pagination" aria-label="Pagination">{result.page > 1 ? <Link href={pageHref(params, result.page - 1)}>{t.previousPage}</Link> : <span /> }<span>{formatMessage(t.pageOf, { page: result.page, pages: result.totalPages })}</span>{result.page < result.totalPages ? <Link href={pageHref(params, result.page + 1)}>{t.nextPage}</Link> : <span />}</nav>}
    </main>
  );
}
import Link from "next/link";
