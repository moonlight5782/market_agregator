import Link from "next/link";
import { demoCategoryName, getDictionary, numberLocale, type Locale } from "../lib/i18n";

type ProductCardProps = { product: any; mode: "demo" | "db"; locale: Locale };

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
      <Link href={`/product/${product.slug}`} className="product-card__link">
        <div className="product-card__image">
          <div className="product-card__badges">
            {discount > 0 && <span className="discount-badge">−{discount}%</span>}
            {inStock > 0 && <span className="stock-badge">● {t.inStock}</span>}
          </div>
          {imageUrl ? <img src={imageUrl} alt={product.title} loading="lazy" decoding="async" /> : <span className="no-image">{t.noImage}</span>}
        </div>
        <div className="product-card__body">
          <div className="product-card__kicker">{brand || category || t.noCategory}</div>
          <h3 className="product-card__title">{product.title}</h3>
          {best ? (
            <>
              <div className="product-card__price-row">
                <div className="product-card__price"><small>{t.from}</small>{Number(best.price).toLocaleString(numberLocale(locale))}<em>{best.currency}</em></div>
                {best.oldPrice && Number(best.oldPrice) > Number(best.price) && <span className="old-price">{Number(best.oldPrice).toLocaleString(numberLocale(locale))}</span>}
              </div>
              <div className="product-card__meta"><span>{offers.length} {t.offersShort}</span><b>{best.store?.name}</b></div>
            </>
          ) : <div className="no-offers">{t.noOffers}</div>}
        </div>
      </Link>
      <div className="product-card__footer"><Link href={`/product/${product.slug}`} className="product-card__cta">{t.compareOffers}<span>↗</span></Link></div>
    </article>
  );
}
