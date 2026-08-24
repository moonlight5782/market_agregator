"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "../lib/i18n";

export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();

  function setLocale(next: Locale) {
    if (next === locale) return;
    document.cookie = `locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="language-switcher" aria-label={label}>
      {(["ru", "ro"] as const).map((item) => (
        <button key={item} type="button" onClick={() => setLocale(item)} aria-pressed={locale === item}>
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
