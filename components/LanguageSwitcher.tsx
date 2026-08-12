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
    <div aria-label={label} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 4, border: "1px solid #ddd", borderRadius: 999, background: "#fff" }}>
      {(["ru", "ro"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLocale(item)}
          aria-pressed={locale === item}
          className="touch-target"
          style={{
            minWidth: 44,
            minHeight: 36,
            border: 0,
            borderRadius: 999,
            cursor: "pointer",
            fontWeight: 800,
            background: locale === item ? "#111" : "transparent",
            color: locale === item ? "#fff" : "#555",
          }}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
