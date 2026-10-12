export interface DailyForecast {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationProbabilityMax?: number;
  rainMm?: number;
}

export interface WeatherContext {
  locationName: string;
  temperatureC: number;
  humidityPercent?: number;
  weatherDescription: string;
  precipitationProbabilityPercent?: number;
  dailyForecast: DailyForecast[];
  fetchedAt: string;
  isForecastData: true;
}

// In-memory cache for geocoding and weather
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const geocodeCache = new Map<string, CacheEntry<{ lat: number; lon: number; name: string }>>();
const weatherCache = new Map<string, CacheEntry<WeatherContext>>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getWmoWeatherDescription(code: number): string {
  switch (code) {
    case 0:
      return 'Clear sky';
    case 1:
      return 'Mainly clear';
    case 2:
      return 'Partly cloudy';
    case 3:
      return 'Overcast';
    case 45:
    case 48:
      return 'Foggy';
    case 51:
    case 53:
    case 55:
      return 'Drizzle';
    case 61:
    case 63:
    case 65:
      return 'Rain';
    case 71:
    case 73:
    case 75:
      return 'Snow';
    case 80:
    case 81:
    case 82:
      return 'Rain showers';
    case 95:
    case 96:
    case 99:
      return 'Thunderstorm';
    default:
      return 'Variable conditions';
  }
}

export async function geocodeLocation(
  query: string
): Promise<{ lat: number; lon: number; name: string } | null> {
  const clean = query.trim();
  if (!clean || clean.length < 2) return null;

  const cached = geocodeCache.get(clean.toLowerCase());
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      clean
    )}&count=1&language=en&format=json`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      results?: Array<{ latitude: number; longitude: number; name: string; country?: string }>;
    };

    if (!data.results || data.results.length === 0) return null;

    const top = data.results[0];
    const result = {
      lat: top.latitude,
      lon: top.longitude,
      name: top.country ? `${top.name}, ${top.country}` : top.name,
    };

    geocodeCache.set(clean.toLowerCase(), {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return result;
  } catch (err) {
    // Non-fatal: geocoding failure returns null
    return null;
  }
}

export async function fetchWeatherForLocation(
  locationQuery?: string,
  coordinates?: { latitude: number; longitude: number }
): Promise<WeatherContext | null> {
  let lat: number;
  let lon: number;
  let locationName: string;

  if (coordinates && typeof coordinates.latitude === 'number' && typeof coordinates.longitude === 'number') {
    lat = coordinates.latitude;
    lon = coordinates.longitude;
    locationName = locationQuery?.trim() || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  } else if (locationQuery && locationQuery.trim().length >= 2) {
    const coords = await geocodeLocation(locationQuery);
    if (!coords) return null;
    lat = coords.lat;
    lon = coords.lon;
    locationName = coords.name;
  } else {
    return null;
  }

  const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=3`;

    const res = await fetch(forecastUrl, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m?: number;
        precipitation?: number;
        weather_code?: number;
      };
      daily?: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max?: number[];
        precipitation_sum?: number[];
      };
    };

    if (!data.current || typeof data.current.temperature_2m !== 'number') return null;

    const dailyForecast: DailyForecast[] = (data.daily?.time || []).map((t, idx) => ({
      date: t,
      tempMaxC: data.daily?.temperature_2m_max?.[idx] ?? data.current!.temperature_2m,
      tempMinC: data.daily?.temperature_2m_min?.[idx] ?? data.current!.temperature_2m,
      precipitationProbabilityMax: data.daily?.precipitation_probability_max?.[idx],
      rainMm: data.daily?.precipitation_sum?.[idx],
    }));

    const weatherContext: WeatherContext = {
      locationName,
      temperatureC: Math.round(data.current.temperature_2m * 10) / 10,
      humidityPercent: data.current.relative_humidity_2m,
      weatherDescription: getWmoWeatherDescription(data.current.weather_code ?? 0),
      precipitationProbabilityPercent: data.daily?.precipitation_probability_max?.[0],
      dailyForecast,
      fetchedAt: new Date().toISOString(),
      isForecastData: true,
    };

    weatherCache.set(cacheKey, {
      data: weatherContext,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return weatherContext;
  } catch (err) {
    // Non-fatal: weather failure degrades gracefully
    return null;
  }
}

export function clearWeatherCache(): void {
  geocodeCache.clear();
  weatherCache.clear();
}
