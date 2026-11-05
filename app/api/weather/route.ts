import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

/**
 * Current weather + today's sunrise/sunset for the visitor's approximate
 * location, for the home sky card. Location comes from Vercel's IP geo
 * headers (no permission prompt); the forecast from Open-Meteo (free, no key).
 * Responses are cached ~15 min per rounded location.
 */
export type WeatherResponse =
  | {
      ok: true;
      temp: number;
      unit: "F" | "C";
      code: number;
      isDay: boolean;
      sunrise: number; // unix ms
      sunset: number; // unix ms
      city: string | null;
    }
  | { ok: false };

const API = process.env.WEATHER_API_BASE || "https://api.open-meteo.com";

export async function GET(request: Request) {
  if (!(await getSessionUser())) return NextResponse.json({ ok: false }, { status: 401 });

  const h = request.headers;
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lon = Number(h.get("x-vercel-ip-longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0) || !h.get("x-vercel-ip-latitude")) {
    return NextResponse.json({ ok: false } satisfies WeatherResponse);
  }
  const country = h.get("x-vercel-ip-country");
  const unit: "F" | "C" = country === "US" || country === "LR" || country === "MM" ? "F" : "C";
  let city: string | null = null;
  try {
    city = h.get("x-vercel-ip-city") ? decodeURIComponent(h.get("x-vercel-ip-city")!) : null;
  } catch {}

  const url =
    `${API}/v1/forecast?latitude=${lat.toFixed(1)}&longitude=${lon.toFixed(1)}` +
    `&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&timeformat=unixtime&forecast_days=1` +
    (unit === "F" ? "&temperature_unit=fahrenheit" : "");

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`weather ${res.status}`);
    const data = await res.json();
    const body: WeatherResponse = {
      ok: true,
      temp: Math.round(data.current.temperature_2m),
      unit,
      code: Number(data.current.weather_code) || 0,
      isDay: data.current.is_day === 1,
      sunrise: data.daily.sunrise[0] * 1000,
      sunset: data.daily.sunset[0] * 1000,
      city,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (err) {
    console.error("[weather]", err);
    return NextResponse.json({ ok: false } satisfies WeatherResponse);
  }
}
