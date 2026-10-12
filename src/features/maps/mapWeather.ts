import { useCallback, useEffect, useState } from "react";
import { isValidCoordinate, type MapViewport } from "@/src/shared/exploration";

export type MapWeather = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
};
const cache = new Map<string, { time: number; value: MapWeather | null }>();
const ttl = 10 * 60_000;
export function weatherCondition(code: number, isDay = true) {
  if (code === 0)
    return { label: isDay ? "Sunny" : "Clear", icon: isDay ? "sun" : "moon" };
  if (code >= 1 && code <= 3)
    return { label: code < 3 ? "Partly cloudy" : "Cloudy", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "fog" };
  if (code >= 95) return { label: "Thunderstorms", icon: "storm" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { label: "Snow", icon: "snow" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return { label: "Rain", icon: "rain" };
  return { label: "Conditions", icon: "cloud" };
}
export function parseMapWeather(body: unknown): MapWeather {
  const current = (body as { current?: Record<string, unknown> })?.current;
  const keys = [
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "wind_speed_10m",
    "weather_code",
    "is_day",
  ];
  if (
    !current ||
    keys.some(
      (key) =>
        typeof current[key] !== "number" || !Number.isFinite(current[key]),
    )
  )
    throw new Error("Weather unavailable");
  return {
    temperature: current.temperature_2m as number,
    feelsLike: current.apparent_temperature as number,
    humidity: current.relative_humidity_2m as number,
    wind: current.wind_speed_10m as number,
    code: current.weather_code as number,
    isDay: current.is_day === 1,
  };
}
export function useMapWeather(viewport: MapViewport | null, enabled: boolean) {
  const meaningful = !!(
    enabled &&
    viewport &&
    viewport.zoom >= 9 &&
    isValidCoordinate(viewport.center)
  );
  const key = meaningful
    ? `${viewport!.center.latitude.toFixed(2)},${viewport!.center.longitude.toFixed(2)}`
    : "";
  const [state, setState] = useState<{
    key: string;
    value: MapWeather | null;
    loading: boolean;
  }>({ key: "", value: null, loading: false });
  const [refresh, setRefresh] = useState(0);
  const retry = useCallback(() => {
    cache.delete(key);
    setRefresh((value) => value + 1);
  }, [key]);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        const saved = cache.get(key);
        if (saved && Date.now() - saved.time < (saved.value ? ttl : 60_000)) {
          setState({ key, value: saved.value, loading: false });
          return;
        }
        setState({ key, value: null, loading: true });
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
          const [latitude, longitude] = key.split(",");
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=1`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("Weather unavailable");
          const value = parseMapWeather(await response.json());
          if (active) {
            if (cache.size >= 64) cache.delete(cache.keys().next().value!);
            cache.set(key, { time: Date.now(), value });
            setState({ key, value, loading: false });
          }
        } catch {
          if (active) {
            cache.set(key, { time: Date.now(), value: null });
            setState({ key, value: null, loading: false });
          }
        } finally {
          clearTimeout(timeout);
        }
      })();
    }, 700);
    const refreshTimer = setInterval(
      () => setRefresh((value) => value + 1),
      ttl,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(refreshTimer);
      controller.abort();
    };
  }, [key, refresh]);
  return {
    retry,
    visible: meaningful,
    value: state.key === key ? state.value : null,
    loading: !!key && (state.key !== key || state.loading),
  };
}
