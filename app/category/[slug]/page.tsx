import { ProductCard } from "../../../components/ProductCard";
import { getCategoryData } from "../../../lib/catalog-data";
import { getLocale } from "../../../lib/get-locale";
import { demoCategoryName, formatMessage, getDictionary } from "../../../lib/i18n";

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const [{ slug }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const t = getDictionary(locale);
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const result = await getCategoryData(slug, page);
  if (!result) return <main style={{ padding: 30, fontFamily: "system-ui" }}>{t.categoryNotFound}</main>;

  const category: any = result.category;
  const categoryName = result.mode === "demo"
    ? demoCategoryName(category.slug, locale, category.nameRu)
    : (locale === "ro" ? category.nameRo || category.nameRu : category.nameRu);

  return (
    <main className="page-shell category-page">
      <Link href="/" style={{ color: "#111", textDecoration: "none" }}>← {t.home}</Link>
      <h1 style={{ fontSize: 40, marginBottom: 8 }}>{categoryName}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>{result.total} {t.itemsInCategory} {result.mode === "demo" ? `· ${t.demoData}` : ""}</p>
      {category.children.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>{category.children.map((child: any) => {
        const childName = locale === "ro" ? child.nameRo || child.nameRu : child.nameRu;
        return <Link key={child.id} href={`/category/${child.slug}`} style={{ padding: "10px 14px", background: "#f3f3f3", borderRadius: 999, color: "#111", textDecoration: "none" }}>{childName}</Link>;
      })}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 18, marginTop: 28 }}>
        {category.products.map((product: any) => <ProductCard key={product.id} product={product} mode={result.mode} locale={locale} />)}
      </div>

      {result.totalPages > 1 && (
        <nav aria-label="Pagination" style={{ display: "flex", gap: 14, justifyContent: "center", alignItems: "center", marginTop: 32 }}>
          {result.page > 1 ? <Link href={`/category/${slug}?page=${result.page - 1}`}>{t.previousPage}</Link> : <span />}
          <span>{formatMessage(t.pageOf, { page: result.page, pages: result.totalPages })}</span>
          {result.page < result.totalPages ? <Link href={`/category/${slug}?page=${result.page + 1}`}>{t.nextPage}</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
import Link from "next/link";
