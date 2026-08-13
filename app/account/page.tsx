import { LoyaltyBarcodeFormat } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth, signOut } from "../../auth";
import { authConfigured } from "../../lib/auth-config";
import { prisma } from "../../lib/prisma";
import { getLocale } from "../../lib/get-locale";
import { getDictionary } from "../../lib/i18n";
import { loyaltyBarcodeLabels } from "../../lib/loyalty-barcode";
import { addLoyaltyCard, deleteLoyaltyCard } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!authConfigured) redirect("/signin");
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session?.user?.id) redirect("/signin");
  const t = getDictionary(locale);
  const [cards, stores] = await Promise.all([
    prisma.loyaltyCard.findMany({
      where: { userId: session.user.id, status: { not: "ARCHIVED" } },
      include: { program: { include: { store: true } } },
      orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.store.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="page-shell" style={{ paddingTop: 72 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div><a href="/" style={{ color: "#111", textDecoration: "none" }}>← {t.home}</a><h1 style={{ marginBottom: 4 }}>{t.account}</h1><div style={{ color: "#666" }}>{session.user.name || session.user.email}</div></div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}><button className="touch-target" style={{ padding: "12px 18px", border: "1px solid #ccc", borderRadius: 12, background: "white" }}>{t.signOut}</button></form>
      </div>

      <section style={{ marginTop: 34 }}>
        <h2>{t.myCards}</h2>
        <p style={{ color: "#666" }}>{t.cardsIntro}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {cards.map((card) => (
            <article key={card.id} style={{ border: "1px solid #e3e3e3", borderRadius: 20, padding: 18, background: card.color || "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><b style={{ fontSize: 19 }}>{card.label}</b>{card.program?.store?.name && <div style={{ color: "#666", fontSize: 13 }}>{card.program.store.name}</div>}</div>{card.favorite && <span aria-label={t.favorite}>★</span>}</div>
              <div style={{ background: "white", borderRadius: 14, padding: 14, marginTop: 16, minHeight: 130, display: "grid", placeItems: "center", overflow: "hidden" }}><img src={`/api/loyalty-cards/${card.id}/barcode`} alt={`${card.label} ${loyaltyBarcodeLabels[card.barcodeFormat]}`} style={{ width: "100%", maxHeight: 180, objectFit: "contain" }} /></div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 10 }}>{loyaltyBarcodeLabels[card.barcodeFormat]}{card.payloadLast4 ? ` · •••• ${card.payloadLast4}` : ""}</div>
              {card.cardholderName && <div style={{ marginTop: 8 }}>{card.cardholderName}</div>}
              {card.pointsBalanceSnapshot != null && <div style={{ marginTop: 8, fontWeight: 800 }}>{Number(card.pointsBalanceSnapshot)} {card.pointsUnit || t.points}</div>}
              <form action={deleteLoyaltyCard} style={{ marginTop: 14 }}><input type="hidden" name="id" value={card.id} /><button style={{ border: 0, background: "transparent", color: "#a22", padding: 0, cursor: "pointer" }}>{t.deleteCard}</button></form>
            </article>
          ))}
          {cards.length === 0 && <div style={{ color: "#777", padding: "28px 0" }}>{t.noCards}</div>}
        </div>
      </section>

      <section style={{ marginTop: 42, borderTop: "1px solid #e5e5e5", paddingTop: 28 }}>
        <h2>{t.addCard}</h2>
        <p style={{ color: "#666" }}>{t.addCardHint}</p>
        <form action={addLoyaltyCard} style={{ display: "grid", gap: 13, maxWidth: 650 }}>
          <select name="storeId" defaultValue="" style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12, background: "white" }}>
            <option value="">{locale === "ro" ? "Alt card / fără legătură cu magazinul" : "Другая карта / без привязки к магазину"}</option>
            {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          <input name="label" required maxLength={120} placeholder={t.cardLabel} style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12 }} />
          <input name="cardholderName" maxLength={120} placeholder={t.cardholderName} style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12 }} />
          <select name="barcodeFormat" defaultValue={LoyaltyBarcodeFormat.CODE_128} style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12, background: "white" }}>{Object.values(LoyaltyBarcodeFormat).map((format) => <option value={format} key={format}>{loyaltyBarcodeLabels[format]}</option>)}</select>
          <textarea name="payload" required maxLength={4096} rows={3} placeholder={t.cardCode} style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12, resize: "vertical" }} />
          <textarea name="notes" maxLength={500} rows={2} placeholder={t.cardNotes} style={{ padding: 14, border: "1px solid #ccc", borderRadius: 12, resize: "vertical" }} />
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" name="favorite" /> {t.favorite}</label>
          <button className="touch-target" style={{ minHeight: 52, border: 0, borderRadius: 13, background: "#111", color: "white", fontWeight: 800, cursor: "pointer" }}>{t.saveCard}</button>
        </form>
        <p style={{ color: "#888", fontSize: 13, maxWidth: 650 }}>{t.cardSecurity}</p>
      </section>
    </main>
  );
}
