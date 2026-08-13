import { auth, signOut } from "../auth";
import { authConfigured } from "../lib/auth-config";
import { getLocale } from "../lib/get-locale";
import { getDictionary } from "../lib/i18n";

export async function AccountNav() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  if (!authConfigured) return <a href="/signin" style={{ color: "#111", fontWeight: 750, textDecoration: "none" }}>{t.signIn}</a>;
  const session = await auth();
  if (!session?.user) return <a href="/signin" style={{ color: "#111", fontWeight: 750, textDecoration: "none" }}>{t.signIn}</a>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <a href="/account" style={{ color: "#111", fontWeight: 750, textDecoration: "none" }}>{t.account}</a>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}><button style={{ border: 0, background: "transparent", color: "#666", cursor: "pointer" }}>{t.signOut}</button></form>
    </div>
  );
}
