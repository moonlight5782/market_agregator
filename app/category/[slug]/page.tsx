import { ProductCard } from "../../../components/ProductCard";
import { getCategoryData } from "../../../lib/catalog-data";

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
        {category.products.map((product: any) => <ProductCard key={product.id} product={product} mode={result.mode} />)}
      </div>
    </main>
  );
}
