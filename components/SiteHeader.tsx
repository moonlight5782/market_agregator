import Link from "next/link";
import { AccountNav } from "./AccountNav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { getLocale } from "../lib/get-locale";
import { getDictionary } from "../lib/i18n";

export async function SiteHeader() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="site-brand" aria-label="Bun Preț Moldova">
            <span className="site-brand__mark"><i />BP</span>
            <span className="site-brand__copy"><strong>BUN PREȚ</strong><small>Moldova</small></span>
          </Link>
          <nav className="site-nav" aria-label={t.catalog}>
            <Link href="/search" className="site-nav__catalog"><span aria-hidden="true">⌕</span><b>{t.catalog}</b></Link>
            <AccountNav />
            <LanguageSwitcher locale={locale} label={t.language} />
          </nav>
        </div>
      </header>
      <nav className="mobile-dock" aria-label={t.catalog}>
        <Link href="/"><span aria-hidden="true">⌂</span><small>{t.home}</small></Link>
        <Link href="/search"><span aria-hidden="true">⌕</span><small>{t.search}</small></Link>
        <Link href="/search?sort=nearest"><span aria-hidden="true">⌖</span><small>{t.nearby}</small></Link>
        <Link href="/account"><span aria-hidden="true">○</span><small>{t.account}</small></Link>
      </nav>
    </>
  );
}
