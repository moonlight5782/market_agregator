import { auth, signIn } from "../../auth";
import { redirect } from "next/navigation";
import { getLocale } from "../../lib/get-locale";
import { getDictionary } from "../../lib/i18n";

export default async function SignInPage() {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (session?.user) redirect("/account");
  const t = getDictionary(locale);
  return (
    <main className="page-shell" style={{ paddingTop: 72, maxWidth: 560 }}>
      <a href="/" style={{ color: "#111", textDecoration: "none" }}>← {t.home}</a>
      <section style={{ marginTop: 28, border: "1px solid #e5e5e5", borderRadius: 24, padding: 28 }}>
        <h1 style={{ marginTop: 0 }}>{t.signInTitle}</h1>
        <p style={{ color: "#666", lineHeight: 1.55 }}>{t.signInText}</p>
        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/account" }); }}>
            <button className="touch-target" style={{ width: "100%", minHeight: 52, border: "1px solid #ccc", borderRadius: 13, background: "white", fontWeight: 800, cursor: "pointer" }}>{t.continueGoogle}</button>
          </form>
          <form action={async () => { "use server"; await signIn("github", { redirectTo: "/account" }); }}>
            <button className="touch-target" style={{ width: "100%", minHeight: 52, border: 0, borderRadius: 13, background: "#111", color: "white", fontWeight: 800, cursor: "pointer" }}>{t.continueGithub}</button>
          </form>
        </div>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 0, marginTop: 20 }}>{t.oauthPrivacy}</p>
      </section>
    </main>
  );
}
