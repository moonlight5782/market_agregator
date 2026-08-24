import type { Metadata } from "next";
import React from "react";
import { SiteHeader } from "../components/SiteHeader";
import { getLocale } from "../lib/get-locale";
import "./globals.css";

const siteUrl = "https://market-agregator-md.moonlight-5782.chatgpt.site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const title = locale === "ro" ? "BUN PREȚ — compară prețurile în Moldova" : "BUN PREȚ — сравнение цен в Молдове";
  const description = locale === "ro" ? "Găsește prețul minim, stocul și magazinul cel mai apropiat." : "Находите минимальную цену, наличие и ближайший магазин.";
  return {
    metadataBase: new URL(siteUrl), title, description,
    openGraph: { title, description, url: siteUrl, siteName: "BUN PREȚ", locale: locale === "ro" ? "ro_MD" : "ru_MD", type: "website", images: [{ url: "/og.png", alt: "BUN PREȚ" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return <html lang={locale}><body><SiteHeader />{children}</body></html>;
}
