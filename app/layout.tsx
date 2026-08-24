import type { Metadata } from "next";
import React from "react";
import { SiteHeader } from "../components/SiteHeader";
import { getLocale } from "../lib/get-locale";
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
  return (
    <html lang={locale}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
