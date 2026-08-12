import type { Metadata } from "next";
import React from "react";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { getLocale } from "../lib/get-locale";
import { getDictionary } from "../lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: "Moldova Commerce",
    description: locale === "ro"
      ? "Căutare unică pentru produse și magazine din Moldova"
      : "Единый поиск товаров и магазинов Молдовы",
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <html lang={locale}>
      <body>
        <div style={{ position: "fixed", top: 14, right: 14, zIndex: 1000 }}>
          <LanguageSwitcher locale={locale} label={t.language} />
        </div>
        {children}
      </body>
    </html>
  );
}
