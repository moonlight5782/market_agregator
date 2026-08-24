"use client";

import { useEffect, useState, type MouseEvent } from "react";

const STORAGE_KEY = "moldova-commerce-location";

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
    clearLocation: string;
  };
};

export default function LocationFilter({ latitude = "", longitude = "", radius = "10", labels }: Props) {
  const [lat, setLat] = useState(latitude);
  const [lon, setLon] = useState(longitude);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(latitude && longitude ? "ready" : "idle");

  useEffect(() => {
    if (latitude && longitude) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: latitude, lon: longitude }));
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.lat && saved?.lon) {
        setLat(String(saved.lat));
        setLon(String(saved.lon));
        setStatus("ready");
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [latitude, longitude]);

  function locate(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.closest("form");
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLon(position.coords.longitude.toFixed(6));
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          lat: position.coords.latitude.toFixed(6),
          lon: position.coords.longitude.toFixed(6),
        }));
        setStatus("ready");
        window.setTimeout(() => form?.requestSubmit(), 0);
      },
      () => setStatus("error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  function clearLocation() {
    setLat("");
    setLon("");
    setStatus("idle");
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="location-filter">
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lon" value={lon} />
      <div className="location-actions">
        <button type="button" onClick={locate} className="touch-target location-button">
          <span aria-hidden="true">⌖</span> {status === "loading" ? labels.locating : status === "ready" ? labels.locationReady : labels.useLocation}
        </button>
        {status === "ready" && <button type="button" onClick={clearLocation} className="location-clear" aria-label={labels.clearLocation}>×</button>}
      </div>
      {status === "error" && <span className="location-error">{labels.locationError}</span>}
      <label className="radius-control">
        {labels.radius}
        <select name="radius" defaultValue={radius}>
          {[2, 5, 10, 25, 50, 100].map((value) => <option key={value} value={value}>{value} km</option>)}
        </select>
      </label>
    </div>
  );
}
