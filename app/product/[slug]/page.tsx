import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StoreHours from "../../../components/StoreHours";
import { getOfficialStoreUrl } from "../../../lib/demo-data";
import { getLocale } from "../../../lib/get-locale";
import { demoCategoryName, formatMessage, getDictionary, numberLocale, stockLabel } from "../../../lib/i18n";
import { getProductBySlug } from "../../../lib/product-data";

function isAvailable(status: string) {
  return status === "IN_STOCK" || status === "LOW_STOCK" || status === "PREORDER";
}

type ProductQuery = { city?: string; lat?: string; lon?: string; radius?: string };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProductBySlug(slug);
  if (!result) return { title: "BUN PREȚ" };
  const product: any = result.product;
  const best = [...(product.offers ?? [])].sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
  const imageUrl = product.imageUrl || best?.imageUrl;
  const description = best ? `Сравните цены от ${Number(best.price).toLocaleString("ru-RU")} ${best.currency} в магазинах Молдовы.` : "Сравните цены в магазинах Молдовы.";
  return {
    title: `${product.title} — цены | BUN PREȚ`, description,
    openGraph: { title: product.title, description, images: imageUrl ? [{ url: imageUrl }] : [] },
    twitter: { card: imageUrl ? "summary_large_image" : "summary", title: product.title, description, images: imageUrl ? [imageUrl] : [] },
  };
}

function validUntilLabel(value: string | null | undefined, locale: "ru" | "ro") {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat(locale === "ro" ? "ro-MD" : "ru-MD", { day: "numeric", month: "long" }).format(date);
  return locale === "ro" ? `Preț din broșură până la ${formatted}` : `Цена из брошюры до ${formatted}`;
}

function backHref(query: ProductQuery) {
  const params = new URLSearchParams();
  if (query.city) params.set("city", query.city);
  if (query.lat) params.set("lat", query.lat);
  if (query.lon) params.set("lon", query.lon);
  if (query.radius) params.set("radius", query.radius);
  if (query.lat && query.lon) params.set("sort", "nearest");
  return params.size ? `/search?${params.toString()}` : "/";
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ProductQuery> }) {
  const [{ slug }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const { city = "", lat = "", lon = "", radius = "10" } = query;
  const t = getDictionary(locale);
  const result = await getProductBySlug(slug, query);
  if (!result) notFound();

  const product: any = result.product;
  const offers = [...product.offers];
  const best = result.hasGeo
    ? [...offers].sort((a: any, b: any) => Number(a.price) - Number(b.price))[0]
    : offers[0];
  const imageUrl = product.imageUrl || best?.imageUrl;
  const categoryName = result.mode === "demo"
    ? demoCategoryName(product.categorySlug, locale, product.categoryName)
    : (locale === "ro" ? product.category?.nameRo || product.category?.nameRu : product.category?.nameRu);
  const brandName = result.mode === "demo" ? product.brand : product.brand?.name;
  const availableOffers = offers.filter((offer: any) => {
    if (offer.availabilities?.length) return offer.availabilities.some((item: any) => isAvailable(item.stockStatus));
    return isAvailable(offer.stockStatus);
  });

  return (
    <main className="page-shell product-page">
      <Link href={backHref(query)} style={{ color: "#111", textDecoration: "none" }}>← {city ? formatMessage(t.goodsInCity, { city }) : t.search}</Link>
      <div className="product-hero">
        <div className="product-hero__image">
          {imageUrl ? <img src={imageUrl} alt={product.title} style={{ objectFit: "contain" }} /> : <span style={{ color: "#888" }}>{t.noImage}</span>}
        </div>
        <section>
          <div style={{ color: "#777", fontSize: 14 }}>{categoryName ?? t.noCategory}{brandName ? ` · ${brandName}` : ""}{city ? ` · ${city}` : ""}</div>
          <h1 className="product-title">{product.title}</h1>
          {best ? (
            <div className="best-price-card">
              <div style={{ color: "#666", fontSize: 14 }}>{t.bestPrice}{city ? ` · ${city}` : ""}</div>
              <div style={{ fontSize: "clamp(28px,8vw,34px)", fontWeight: 900, marginTop: 3 }}>{t.from} {Number(best.price).toLocaleString(numberLocale(locale))} {best.currency}</div>
              <div style={{ color: "#666", marginTop: 7 }}>{offers.length} {t.offersShort} · {availableOffers.length} {t.confirmedStock}</div>
              {result.hasGeo && offers[0]?.distanceKm != null && (
                <div style={{ marginTop: 7, color: "#555" }}>{t.nearestStore}: {formatMessage(t.distanceAway, { distance: Number(offers[0].distanceKm).toFixed(1) })}</div>
              )}
            </div>
          ) : (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 18, padding: 20, marginBottom: 22, color: "#666" }}>{t.noCurrentOffers}{city ? ` · ${city}` : ""}.</div>
          )}
          {result.mode === "db" && product.description && <p style={{ color: "#555", lineHeight: 1.6 }}>{product.description}</p>}
          {result.mode === "db" && product.attributes && Object.keys(product.attributes).length > 0 && (
            <div style={{ marginTop: 22 }}>
              <h2 style={{ fontSize: 20 }}>{t.specifications}</h2>
              <div className="spec-grid">
                {Object.entries(product.attributes).slice(0, 12).map(([key, value]) => <div key={key} style={{ padding: "10px 12px", background: "#f6f6f6", borderRadius: 10, overflowWrap: "anywhere" }}><span style={{ color: "#777" }}>{key}: </span><b>{String(value)}</b></div>)}
              </div>
            </div>
          )}
        </section>
      </div>

      <section style={{ marginTop: 44 }}>
        <h2 style={{ fontSize: 28, marginBottom: 6 }}>{t.storeOffers}</h2>
        <p style={{ marginTop: 0, color: "#666" }}>{t.offerExplanation}</p>
        <p className="external-checkout-note">{t.externalCheckout}</p>
        <div className="offer-list">
          {offers.map((offer: any) => {
            const branches = offer.availabilities ?? [];
            const selectedBranch = branches[0];
            const location = offer.nearestLocation ?? selectedBranch?.location ?? offer.location;
            const status = selectedBranch?.stockStatus ?? offer.stockStatus;
            const quantity = selectedBranch?.quantity ?? offer.quantity;
            const branchAvailableCount = branches.filter((item: any) => isAvailable(item.stockStatus)).length;
            const isBrochureOffer = Boolean(offer.sourceName || offer.sourceUrl);
            const storeUrl = !isBrochureOffer ? offer.externalUrl : getOfficialStoreUrl(offer.store);
            const sourceUrl = isBrochureOffer ? (offer.sourceUrl || offer.externalUrl) : null;
            return (
              <div key={offer.id} className="offer-row">
                <div>
                  <b style={{ fontSize: 17 }}>{offer.store.name}</b>
                  {location && <div style={{ color: "#777", fontSize: 13, marginTop: 3 }}>{location.city}{location.address ? ` · ${location.address}` : ""}</div>}
                  <StoreHours openingHours={location?.openingHours ?? (result.mode === "demo" ? offer.store.openingHours : null)} locale={locale} t={t} />
                  {offer.distanceKm != null && <div style={{ color: "#555", fontSize: 13, marginTop: 3 }}>{t.nearestStore}: {formatMessage(t.distanceAway, { distance: Number(offer.distanceKm).toFixed(1) })}</div>}
                  {validUntilLabel(offer.validUntil, locale) && <div className="flyer-validity">{validUntilLabel(offer.validUntil, locale)}{offer.sourceName ? ` · ${offer.sourceName}` : ""}</div>}
                  {!city && !result.hasGeo && branches.length > 1 && <div style={{ color: "#777", fontSize: 13, marginTop: 3 }}>{formatMessage(t.availableInBranches, { available: branchAvailableCount, total: branches.length })}</div>}
                </div>
                <div>{offer.oldPrice && Number(offer.oldPrice) > Number(offer.price) && <div style={{ color: "#999", textDecoration: "line-through", fontSize: 13 }}>{Number(offer.oldPrice).toLocaleString(numberLocale(locale))} {offer.currency}</div>}<div className="offer-row__price">{Number(offer.price).toLocaleString(numberLocale(locale))} {offer.currency}</div></div>
                <div className="stock-stack" style={{ color: status === "OUT_OF_STOCK" ? "#888" : "#333" }}><span>{stockLabel(status, quantity, locale)}</span>{quantity == null && <small className="availability-note">{locale === "ro" ? "verificați în magazin" : "уточняйте в магазине"}</small>}</div>
                <div className="offer-row__actions">
                  {storeUrl && <a href={storeUrl} target="_blank" rel="noreferrer" className="offer-row__cta touch-target">{t.toStore}</a>}
                  {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="offer-row__cta offer-row__cta--secondary touch-target">{t.priceSource}</a>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
import Link from "next/link";
