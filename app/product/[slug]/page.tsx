import { notFound } from "next/navigation";
import { getProductBySlug } from "../../../lib/product-data";

function stockLabel(status: string, quantity?: number | null) {
  const base = status === "IN_STOCK" ? "В наличии" : status === "LOW_STOCK" ? "Мало" : status === "OUT_OF_STOCK" ? "Нет в наличии" : status === "PREORDER" ? "Предзаказ" : "Наличие уточняется";
  return quantity != null ? `${base} · ${quantity} шт.` : base;
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getProductBySlug(slug);
  if (!result) notFound();

  const product: any = result.product;
  const offers = [...product.offers].sort((a: any, b: any) => Number(a.price) - Number(b.price));
  const best = offers[0];
  const imageUrl = product.imageUrl || best?.imageUrl;
  const categoryName = result.mode === "demo" ? product.categoryName : product.category?.nameRu;
  const brandName = result.mode === "demo" ? product.brand : product.brand?.name;

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 64px", fontFamily: "system-ui" }}>
      <a href="/" style={{ color: "#111", textDecoration: "none" }}>← Главная</a>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,420px) 1fr", gap: 38, marginTop: 24, alignItems: "start" }}>
        <div style={{ background: "#f6f6f6", borderRadius: 22, overflow: "hidden", minHeight: 360, display: "grid", placeItems: "center" }}>
          {imageUrl ? <img src={imageUrl} alt={product.title} style={{ width: "100%", height: 420, objectFit: result.mode === "demo" ? "cover" : "contain" }} /> : <span style={{ color: "#888" }}>Нет изображения</span>}
        </div>
        <section>
          <div style={{ color: "#777", fontSize: 14 }}>{categoryName ?? "Без категории"}{brandName ? ` · ${brandName}` : ""}</div>
          <h1 style={{ fontSize: 40, lineHeight: 1.08, margin: "10px 0 18px" }}>{product.title}</h1>
          {best && (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 18, padding: 20, marginBottom: 22 }}>
              <div style={{ color: "#666", fontSize: 14 }}>Лучшая цена</div>
              <div style={{ fontSize: 34, fontWeight: 900, marginTop: 3 }}>от {Number(best.price).toLocaleString("ru-RU")} {best.currency}</div>
              <div style={{ color: "#666", marginTop: 7 }}>{offers.length} предлож. · {offers.filter((o: any) => o.stockStatus === "IN_STOCK").length} в наличии</div>
            </div>
          )}
          {result.mode === "db" && product.description && <p style={{ color: "#555", lineHeight: 1.6 }}>{product.description}</p>}
          {result.mode === "db" && product.attributes && Object.keys(product.attributes).length > 0 && (
            <div style={{ marginTop: 22 }}>
              <h2 style={{ fontSize: 20 }}>Характеристики</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.entries(product.attributes).slice(0, 12).map(([key, value]) => <div key={key} style={{ padding: "10px 12px", background: "#f6f6f6", borderRadius: 10 }}><span style={{ color: "#777" }}>{key}: </span><b>{String(value)}</b></div>)}
              </div>
            </div>
          )}
        </section>
      </div>

      <section style={{ marginTop: 44 }}>
        <h2 style={{ fontSize: 28, marginBottom: 6 }}>Предложения магазинов</h2>
        <p style={{ marginTop: 0, color: "#666" }}>Цена, наличие и ссылка берутся из конкретного магазина.</p>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 18, overflow: "hidden", background: "white" }}>
          {offers.map((offer: any, index: number) => {
            const url = result.mode === "demo" ? offer.externalUrl : offer.externalUrl;
            return (
              <div key={offer.id} style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.3fr) minmax(130px,1fr) minmax(150px,1fr) auto", gap: 16, alignItems: "center", padding: 18, borderTop: index ? "1px solid #eee" : "none" }}>
                <div><b style={{ fontSize: 17 }}>{offer.store.name}</b>{offer.location && <div style={{ color: "#777", fontSize: 13, marginTop: 3 }}>{offer.location.city}{offer.location.address ? ` · ${offer.location.address}` : ""}</div>}</div>
                <div>{offer.oldPrice && Number(offer.oldPrice) > Number(offer.price) && <div style={{ color: "#999", textDecoration: "line-through", fontSize: 13 }}>{Number(offer.oldPrice).toLocaleString("ru-RU")} {offer.currency}</div>}<div style={{ fontSize: 21, fontWeight: 900 }}>{Number(offer.price).toLocaleString("ru-RU")} {offer.currency}</div></div>
                <div style={{ color: offer.stockStatus === "OUT_OF_STOCK" ? "#888" : "#333" }}>{stockLabel(offer.stockStatus, offer.quantity)}</div>
                <a href={url} target="_blank" rel="noreferrer" style={{ padding: "11px 15px", background: "#111", color: "white", borderRadius: 10, textDecoration: "none", fontWeight: 800, whiteSpace: "nowrap" }}>В магазин ↗</a>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
