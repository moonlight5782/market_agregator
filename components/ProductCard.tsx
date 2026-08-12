type ProductCardProps = {
  product: any;
  mode: "demo" | "db";
};

export function ProductCard({ product, mode }: ProductCardProps) {
  const offers = [...(product.offers ?? [])].sort((a: any, b: any) => Number(a.price) - Number(b.price));
  const best = offers[0];
  const category = mode === "demo" ? product.categoryName : product.category?.nameRu;
  const brand = mode === "demo" ? product.brand : product.brand?.name;
  const imageUrl = product.imageUrl || best?.imageUrl;
  const inStock = offers.filter((offer: any) => offer.stockStatus === "IN_STOCK" || offer.stockStatus === "LOW_STOCK").length;

  return (
    <article className="product-card">
      <a href={`/product/${product.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
        <div className="product-card__image">
          {imageUrl ? <img src={imageUrl} alt={product.title} style={{ width: "100%", height: "100%", objectFit: mode === "demo" ? "cover" : "contain" }} /> : <span style={{ color: "#888" }}>Нет изображения</span>}
        </div>
        <div className="product-card__body">
          <div style={{ fontSize: 13, color: "#777" }}>{category ?? "Без категории"}{brand ? ` • ${brand}` : ""}</div>
          <h3 className="product-card__title">{product.title}</h3>
          {best ? <>
            <div className="product-card__price">от {Number(best.price).toLocaleString("ru-RU")} {best.currency}</div>
            <div style={{ color: "#666", marginTop: 6 }}>{offers.length} предлож. · {inStock} в наличии</div>
          </> : <div style={{ color: "#777" }}>Предложений пока нет</div>}
        </div>
      </a>
      <div className="product-card__footer">
        <a href={`/product/${product.slug}`} className="product-card__cta touch-target">Сравнить предложения</a>
      </div>
    </article>
  );
}
