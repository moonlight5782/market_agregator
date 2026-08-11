import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Moldova Commerce",
  description: "Единый поиск товаров и магазинов Молдовы",
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="ru"><body style={{margin: 0, color: "#171717", background: "#fff"}}>{children}</body></html>;
}
