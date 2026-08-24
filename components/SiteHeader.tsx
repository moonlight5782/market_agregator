import { AccountNav } from "./AccountNav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getLocale } from "../lib/get-locale";
import { getDictionary } from "../lib/i18n";

export async function SiteHeader() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-brand" aria-label="Moldova Commerce">
          <span className="site-brand__mark">MC</span>
          <span className="site-brand__name">Moldova Commerce</span>
        </Link>
        <nav className="site-nav" aria-label={t.catalog}>
          <Link href="/search" className="site-nav__link"><span aria-hidden="true">⌕</span><span>{t.catalog}</span></Link>
          <AccountNav />
          <LanguageSwitcher locale={locale} label={t.language} />
        </nav>
      </div>
    </header>
  );
}
import Link from "next/link";
