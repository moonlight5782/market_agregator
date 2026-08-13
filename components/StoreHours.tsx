import { getStoreHoursStatus } from "../lib/opening-hours";
import type { Dictionary, Locale } from "../lib/i18n";

export default function StoreHours({ openingHours, locale, t }: { openingHours: unknown; locale: Locale; t: Dictionary }) {
  const status = getStoreHoursStatus(openingHours, new Date(), locale);
  const label = status.state === "open"
    ? t.openNow
    : status.state === "closed"
      ? t.closedNow
      : status.state === "online_only"
        ? t.onlineOnly
        : status.state === "temporarily_closed"
          ? t.temporarilyClosed
          : t.hoursUnknown;
  const color = status.state === "open" ? "#16803a" : status.state === "closed" || status.state === "temporarily_closed" ? "#a33a2b" : "#666";

  return (
    <div style={{ color, fontSize: 13, marginTop: 3 }}>
      <b>{label}</b>
      {status.today && <span style={{ color: "#666", fontWeight: 400 }}> · {t.todayHours}: {status.today}</span>}
    </div>
  );
}

