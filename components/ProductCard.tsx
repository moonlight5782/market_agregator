import { demoCategoryName, getDictionary, numberLocale, type Locale } from "../lib/i18n";

type ProductCardProps = {
  product: any;
  mode: "demo" | "db";
  locale: Locale;
};

export function ProductCard({ product, mode, locale }: ProductCardProps) {
  const t = getDictionary(locale);
  const offers = [...(product.offers ?? [])].sort((a: any, b: any) => Number(a.price) - Number(b.price));
  const best = offers[0];
  const category = mode === "demo"
    ? demoCategoryName(product.categorySlug, locale, product.categoryName)
    : (locale === "ro" ? product.category?.nameRo || product.category?.nameRu : product.category?.nameRu);
  const brand = mode === "demo" ? product.brand : product.brand?.name;
  const imageUrl = product.imageUrl || best?.imageUrl;
  const inStock = offers.filter((offer: any) => offer.stockStatus === "IN_STOCK" || offer.stockStatus === "LOW_STOCK").length;
  const discount = best?.oldPrice && Number(best.oldPrice) > Number(best.price)
    ? Math.round((1 - Number(best.price) / Number(best.oldPrice)) * 100)
    : 0;

  return (
    <article className="product-card">
      <Link href={`/product/${product.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
        <div className="product-card__image">
          {discount > 0 && <span className="discount-badge">−{discount}%</span>}
          {imageUrl ? <img src={imageUrl} alt={product.title} style={{ width: "100%", height: "100%", objectFit: mode === "demo" ? "cover" : "contain" }} /> : <span style={{ color: "#888" }}>{t.noImage}</span>}
        </div>
        <div className="product-card__body">
          <div style={{ fontSize: 13, color: "#777" }}>{category ?? t.noCategory}{brand ? ` • ${brand}` : ""}</div>
          <h3 className="product-card__title">{product.title}</h3>
          {best ? <>
            <div className="product-card__price"><small>{t.from}</small> {Number(best.price).toLocaleString(numberLocale(locale))} <small>{best.currency}</small></div>
            {best.oldPrice && Number(best.oldPrice) > Number(best.price) && <div className="old-price">{Number(best.oldPrice).toLocaleString(numberLocale(locale))} {best.currency}</div>}
            <div className="product-card__meta"><b>{best.store?.name}</b><span>{offers.length} {t.offersShort} · {inStock} {t.inStock}</span></div>
          </> : <div style={{ color: "#777" }}>{t.noOffers}</div>}
        </div>
      </Link>
      <div className="product-card__footer">
        <Link href={`/product/${product.slug}`} className="product-card__cta touch-target">{t.compareOffers}</Link>
      </div>
    </article>
  );
}
import Link from "next/link";
