"use client";

import { useEffect, useMemo, useState } from "react";
import type { WeatherResponse } from "@/app/api/weather/route";

/**
 * Home "window": a sky that follows the real time of day (dawn, day, dusk,
 * night, with the sun or moon along an arc) and the local weather (clouds,
 * rain, snow, fog, storms) plus the time and temperature. Weather is
 * optional; without it the sky still runs on clock time.
 */

type Phase = "night" | "dawn" | "day" | "dusk";
type Kind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

const HOUR = 3600_000;

function weatherKind(code: number): Kind {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "partly";
}

const LABEL: Record<Kind, string> = {
  clear: "Clear",
  partly: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Foggy",
  drizzle: "Drizzle",
  rain: "Rain",
  snow: "Snow",
  storm: "Thunderstorm",
};

const CLOUDS: Record<Kind, number> = { clear: 0, partly: 2, cloudy: 4, fog: 2, drizzle: 4, rain: 5, snow: 4, storm: 5 };

/** Today's sunrise/sunset from the weather, else a plain 6:30–18:00 guess. */
function sunTimes(now: Date, w: WeatherResponse | null): { rise: number; set: number } {
  if (w?.ok) return { rise: w.sunrise, set: w.sunset };
  const d = new Date(now);
  return { rise: d.setHours(6, 30, 0, 0), set: new Date(now).setHours(18, 0, 0, 0) };
}

function phaseAt(t: number, rise: number, set: number): Phase {
  if (t >= rise - HOUR && t < rise + HOUR) return "dawn";
  if (t >= set - HOUR && t < set + HOUR) return "dusk";
  if (t >= rise && t < set) return "day";
  return "night";
}

/** Deterministic pseudo-random numbers so stars and drops don't jump on re-render. */
function seeded(n: number, seed: number): number[] {
  const out: number[] = [];
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    out.push(x / 233280);
  }
  return out;
}

export function SkyCard() {
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    fetch("/api/weather")
      .then((r) => (r.ok ? r.json() : null))
      .then((w: WeatherResponse | null) => setWeather(w))
      .catch(() => setWeather(null));
    return () => clearInterval(id);
  }, []);

  const stars = useMemo(() => {
    const r = seeded(90, 7);
    return Array.from({ length: 30 }, (_, i) => ({ x: r[i * 3] * 100, y: r[i * 3 + 1] * 60, d: 2 + r[i * 3 + 2] * 3 }));
  }, []);
  const drops = useMemo(() => {
    const r = seeded(120, 11);
    return Array.from({ length: 40 }, (_, i) => ({ x: r[i * 3] * 100, delay: r[i * 3 + 1] * 1.2, dur: 0.6 + r[i * 3 + 2] * 0.5 }));
  }, []);

  const t = now?.getTime() ?? 0;
  const { rise, set } = now ? sunTimes(now, weather) : { rise: 0, set: 0 };
  const phase: Phase = now ? phaseAt(t, rise, set) : "day";
  const w = weather?.ok ? weather : null;
  const kind: Kind = w ? weatherKind(w.code) : "clear";
  const heavy = kind === "cloudy" || kind === "rain" || kind === "storm" || kind === "drizzle" || kind === "fog" || kind === "snow";
  const overcast = heavy && phase === "day";
  const dark = phase === "night";

  const top = overcast ? "var(--sky-overcast-top)" : `var(--sky-${phase}-top)`;
  const bottom = overcast ? "var(--sky-overcast-bottom)" : `var(--sky-${phase}-bottom)`;

  // Sun/moon position along an arc: 0 = rising on the left, 1 = setting on the right.
  let p: number;
  if (!dark) p = (t - rise) / (set - rise);
  else {
    const nightLen = 24 * HOUR - (set - rise);
    const sinceSet = t >= set ? t - set : t + 24 * HOUR - set;
    p = sinceSet / nightLen;
  }
  p = Math.min(1, Math.max(0, p));
  const orbX = 8 + p * 84;
  const orbY = 72 - Math.sin(Math.PI * p) * 58;

  const showStars = dark && kind !== "cloudy" && kind !== "rain" && kind !== "storm" && kind !== "fog";
  const precip = kind === "rain" || kind === "drizzle" || kind === "storm" ? "rain" : kind === "snow" ? "snow" : null;
  const cloudColor = dark || overcast ? "var(--sky-cloud-dim)" : "var(--sky-cloud)";

  return (
    <div
      className="card relative h-full min-h-[13rem] overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`, transition: "background 2s" }}
      aria-label={now ? `${LABEL[kind]}${w ? `, ${w.temp}°${w.unit}` : ""}` : "Sky"}
      role="img"
    >
      {now && (
        <>
          {showStars &&
            stars.map((s, i) => (
              <span
                key={i}
                className="sky-twinkle absolute rounded-full"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: 2,
                  height: 2,
                  background: "var(--sky-star)",
                  animationDuration: `${s.d}s`,
                }}
              />
            ))}

          {/* Sun or moon */}
          {!heavy && (
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${orbX}%`,
                top: `${orbY}%`,
                width: dark ? 30 : 44,
                height: dark ? 30 : 44,
                background: dark ? "var(--sky-moon)" : "var(--sky-sun)",
                boxShadow: dark
                  ? "0 0 18px 4px color-mix(in srgb, var(--sky-moon) 45%, transparent)"
                  : "0 0 40px 12px color-mix(in srgb, var(--sky-sun) 55%, transparent)",
                transition: "left 30s linear, top 30s linear",
              }}
            />
          )}

          {/* Clouds drifting across */}
          {Array.from({ length: CLOUDS[kind] }, (_, i) => (
            <div
              key={i}
              className="sky-drift pointer-events-none absolute inset-x-0"
              style={{ top: `${6 + ((i * 17) % 40)}%`, animationDuration: `${55 + i * 18}s`, animationDelay: `-${i * 23}s` }}
            >
              <Cloud color={cloudColor} scale={0.8 + ((i * 37) % 10) / 20} />
            </div>
          ))}

          {kind === "fog" && (
            <div
              className="absolute inset-x-0 bottom-0 h-2/3"
              style={{ background: "linear-gradient(0deg, color-mix(in srgb, var(--sky-cloud) 70%, transparent), transparent)" }}
            />
          )}

          {precip &&
            drops.slice(0, kind === "drizzle" ? 18 : 40).map((d, i) => (
              <span
                key={i}
                className="sky-fall absolute top-0"
                style={{
                  left: `${d.x}%`,
                  width: precip === "snow" ? 4 : 1.5,
                  height: precip === "snow" ? 4 : 12,
                  borderRadius: precip === "snow" ? 9999 : 1,
                  background: "var(--sky-rain)",
                  opacity: 0.8,
                  animationDuration: `${precip === "snow" ? d.dur * 5 : d.dur}s`,
                  animationDelay: `-${d.delay * (precip === "snow" ? 5 : 1)}s`,
                }}
              />
            ))}

          {kind === "storm" && <div className="sky-flash absolute inset-0" style={{ background: "var(--sky-cloud)" }} />}

          {/* Readout */}
          <div
            className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4"
            style={{ color: "var(--sky-text)", textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}
          >
            <div>
              <p className="font-display text-4xl font-semibold leading-none tabular-nums">
                {now.getHours() % 12 || 12}:{String(now.getMinutes()).padStart(2, "0")}
                <span className="ml-1 font-sans text-base font-semibold opacity-90">{now.getHours() < 12 ? "AM" : "PM"}</span>
              </p>
              <p className="mt-1 text-sm opacity-90">
                {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </p>
            </div>
            {w && (
              <div className="text-right">
                <p className="text-3xl font-semibold leading-none tabular-nums">
                  {w.temp}°<span className="text-base opacity-90">{w.unit}</span>
                </p>
                <p className="mt-1 text-sm opacity-90">
                  {LABEL[kind]}
                  {w.city ? ` · ${w.city}` : ""}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Cloud({ color, scale }: { color: string; scale: number }) {
  return (
    <svg width={120 * scale} height={50 * scale} viewBox="0 0 120 50" aria-hidden style={{ opacity: 0.92 }}>
      <g fill={color}>
        <ellipse cx="38" cy="32" rx="30" ry="16" />
        <ellipse cx="62" cy="22" rx="26" ry="20" />
        <ellipse cx="86" cy="32" rx="28" ry="15" />
        <rect x="14" y="30" width="96" height="18" rx="9" />
      </g>
    </svg>
  );
}
