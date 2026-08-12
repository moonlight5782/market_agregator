import { ProductCard } from "../../../components/ProductCard";
import { getCategoryData } from "../../../lib/catalog-data";
import { getLocale } from "../../../lib/get-locale";
import { demoCategoryName, getDictionary } from "../../../lib/i18n";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const t = getDictionary(locale);
  const result = await getCategoryData(slug);
  if (!result) return <main style={{ padding: 30, fontFamily: "system-ui" }}>{t.categoryNotFound}</main>;

  const category: any = result.category;
  const categoryName = result.mode === "demo"
    ? demoCategoryName(category.slug, locale, category.nameRu)
    : (locale === "ro" ? category.nameRo || category.nameRu : category.nameRu);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 20px 56px", fontFamily: "system-ui" }}>
      <a href="/" style={{ color: "#111", textDecoration: "none" }}>← {t.home}</a>
      <h1 style={{ fontSize: 40, marginBottom: 8 }}>{categoryName}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>{category.products.length} {t.itemsInCategory} {result.mode === "demo" ? `· ${t.demoData}` : ""}</p>
      {category.children.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>{category.children.map((child: any) => {
        const childName = locale === "ro" ? child.nameRo || child.nameRu : child.nameRu;
        return <a key={child.id} href={`/category/${child.slug}`} style={{ padding: "10px 14px", background: "#f3f3f3", borderRadius: 999, color: "#111", textDecoration: "none" }}>{childName}</a>;
      })}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 18, marginTop: 28 }}>
        {category.products.map((product: any) => <ProductCard key={product.id} product={product} mode={result.mode} locale={locale} />)}
      </div>
    </main>
  );
}
