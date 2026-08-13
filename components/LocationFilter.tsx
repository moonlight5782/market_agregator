"use client";

import { useState } from "react";

type Props = {
  latitude?: string;
  longitude?: string;
  radius?: string;
  labels: {
    useLocation: string;
    locating: string;
    locationReady: string;
    locationError: string;
    radius: string;
  };
};

export default function LocationFilter({ latitude = "", longitude = "", radius = "10", labels }: Props) {
  const [lat, setLat] = useState(latitude);
  const [lon, setLon] = useState(longitude);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(latitude && longitude ? "ready" : "idle");

  function locate() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLon(position.coords.longitude.toFixed(6));
        setStatus("ready");
      },
      () => setStatus("error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lon" value={lon} />
      <button type="button" onClick={locate} className="touch-target" style={{ padding: "0 14px", border: "1px solid #ccc", borderRadius: 12, background: "white", fontWeight: 700 }}>
        {status === "loading" ? labels.locating : status === "ready" ? labels.locationReady : labels.useLocation}
      </button>
      {status === "error" && <span style={{ color: "#a33", fontSize: 12 }}>{labels.locationError}</span>}
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#555" }}>
        {labels.radius}
        <select name="radius" defaultValue={radius} style={{ padding: 7, border: "1px solid #ccc", borderRadius: 9, background: "white" }}>
          {[2, 5, 10, 25, 50, 100].map((value) => <option key={value} value={value}>{value} km</option>)}
        </select>
      </label>
    </div>
  );
}
