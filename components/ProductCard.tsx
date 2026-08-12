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
    <article style={{ border: "1px solid #e8e8e8", borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.05)" }}>
      <a href={`/product/${product.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
        <div style={{ height: 190, background: "#f5f5f5", display: "grid", placeItems: "center" }}>
          {imageUrl ? <img src={imageUrl} alt={product.title} style={{ width: "100%", height: "100%", objectFit: mode === "demo" ? "cover" : "contain" }} /> : <span style={{ color: "#888" }}>Нет изображения</span>}
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 13, color: "#777" }}>{category ?? "Без категории"}{brand ? ` • ${brand}` : ""}</div>
          <h3 style={{ minHeight: 48, margin: "8px 0 12px" }}>{product.title}</h3>
          {best ? <>
            <div style={{ fontWeight: 900, fontSize: 24 }}>от {Number(best.price).toLocaleString("ru-RU")} {best.currency}</div>
            <div style={{ color: "#666", marginTop: 6 }}>{offers.length} предлож. · {inStock} в наличии</div>
          </> : <div style={{ color: "#777" }}>Предложений пока нет</div>}
        </div>
      </a>
      <div style={{ padding: "0 18px 18px" }}>
        <a href={`/product/${product.slug}`} style={{ display: "block", textAlign: "center", padding: 11, borderRadius: 11, background: "#111", color: "white", textDecoration: "none", fontWeight: 750 }}>Сравнить предложения</a>
      </div>
    </article>
  );
}
