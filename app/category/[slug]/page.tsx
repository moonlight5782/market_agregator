import { getCategoryData } from "../../../lib/catalog-data";
import { getBestOffer } from "../../../lib/demo-data";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getCategoryData(slug);
  if (!result) return <main style={{ padding: 30, fontFamily: "system-ui" }}>Категория не найдена.</main>;

  const category: any = result.category;
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 20px 56px", fontFamily: "system-ui" }}>
      <a href="/" style={{ color: "#111", textDecoration: "none" }}>← Главная</a>
      <h1 style={{ fontSize: 40, marginBottom: 8 }}>{category.nameRu}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>{category.products.length} товаров {result.mode === "demo" ? "· demo data" : ""}</p>
      {category.children.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>{category.children.map((child: any) => <a key={child.id} href={`/category/${child.slug}`} style={{ padding: "10px 14px", background: "#f3f3f3", borderRadius: 999, color: "#111", textDecoration: "none" }}>{child.nameRu}</a>)}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 18, marginTop: 28 }}>
        {category.products.map((product: any) => {
          const best = result.mode === "demo" ? getBestOffer(product) : product.offers[0];
          const brand = result.mode === "demo" ? product.brand : product.brand?.name;
          return (
            <article key={product.id} style={{ border: "1px solid #e5e5e5", borderRadius: 18, overflow: "hidden", background: "white", boxShadow: "0 8px 24px rgba(0,0,0,.04)" }}>
              <a href={`/product/${product.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                <div style={{ height: 190, background: "#f6f6f6" }}>{product.imageUrl && <img src={product.imageUrl} alt={product.title} style={{ width: "100%", height: "100%", objectFit: result.mode === "demo" ? "cover" : "contain" }} />}</div>
                <div style={{ padding: 18 }}>
                  <div style={{ fontSize: 13, color: "#777" }}>{brand ?? ""}</div>
                  <h3 style={{ minHeight: 48, margin: "8px 0 12px" }}>{product.title}</h3>
                  {best ? <><div style={{ fontSize: 22, fontWeight: 900 }}>от {Number(best.price).toLocaleString("ru-RU")} {best.currency}</div><div style={{ marginTop: 6, color: "#666" }}>{product.offers.length} предлож.</div></> : <div>Нет активных предложений</div>}
                </div>
              </a>
              <div style={{ padding: "0 18px 18px" }}><a href={`/product/${product.slug}`} style={{ display: "block", textAlign: "center", padding: 11, background: "#111", color: "white", borderRadius: 10, textDecoration: "none", fontWeight: 750 }}>Сравнить цены</a></div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
