import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  geocodeLocation,
  fetchWeatherForLocation,
  clearWeatherCache,
} from '../server/services/weather';

describe('Open-Meteo Weather Service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearWeatherCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearWeatherCache();
  });

  describe('geocodeLocation', () => {
    it('returns null for empty or too short query', async () => {
      const resEmpty = await geocodeLocation('');
      expect(resEmpty).toBeNull();

      const resShort = await geocodeLocation('a');
      expect(resShort).toBeNull();
    });

    it('successfully geocodes location and caches the result', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              latitude: 28.6139,
              longitude: 77.209,
              name: 'New Delhi',
              country: 'India',
            },
          ],
        }),
      });
      globalThis.fetch = mockFetch as any;

      const firstCall = await geocodeLocation('New Delhi');
      expect(firstCall).toBeDefined();
      expect(firstCall?.name).toBe('New Delhi, India');
      expect(firstCall?.lat).toBe(28.6139);
      expect(firstCall?.lon).toBe(77.209);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should hit memory cache without calling fetch again
      const secondCall = await geocodeLocation('New Delhi');
      expect(secondCall).toEqual(firstCall);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns null on upstream HTTP error or network timeout', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
      globalThis.fetch = mockFetch as any;

      const res = await geocodeLocation('Unknown City');
      expect(res).toBeNull();
    });

    it('returns null when geocoding returns no results', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });
      globalThis.fetch = mockFetch as any;

      const res = await geocodeLocation('NonexistentPlaceXYZ123');
      expect(res).toBeNull();
    });
  });

  describe('fetchWeatherForLocation', () => {
    it('returns null when neither location query nor coordinates are provided', async () => {
      const res = await fetchWeatherForLocation();
      expect(res).toBeNull();
    });

    it('fetches and structures forecast using explicit coordinates', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          current: {
            temperature_2m: 29.4,
            relative_humidity_2m: 65,
            weather_code: 1, // Mainly clear
          },
          daily: {
            time: ['2026-10-12', '2026-10-13', '2026-10-14'],
            temperature_2m_max: [32.1, 31.5, 30.0],
            temperature_2m_min: [22.0, 21.5, 20.2],
            precipitation_probability_max: [10, 40, 20],
            precipitation_sum: [0.0, 2.5, 0.0],
          },
        }),
      });
      globalThis.fetch = mockFetch as any;

      const weather = await fetchWeatherForLocation('Jaipur Balcony', {
        latitude: 26.9124,
        longitude: 75.7873,
      });

      expect(weather).toBeDefined();
      expect(weather?.locationName).toBe('Jaipur Balcony');
      expect(weather?.temperatureC).toBe(29.4);
      expect(weather?.weatherDescription).toBe('Mainly clear');
      expect(weather?.humidityPercent).toBe(65);
      expect(weather?.isForecastData).toBe(true);
      expect(weather?.dailyForecast.length).toBe(3);
      expect(weather?.dailyForecast[1].rainMm).toBe(2.5);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Cached call
      const cached = await fetchWeatherForLocation('Jaipur Balcony', {
        latitude: 26.9124,
        longitude: 75.7873,
      });
      expect(cached).toEqual(weather);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('handles geocoding followed by weather forecast lookup', async () => {
      const mockFetch = vi
        .fn()
        // 1st call: geocoding
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              {
                latitude: 19.076,
                longitude: 72.8777,
                name: 'Mumbai',
                country: 'India',
              },
            ],
          }),
        })
        // 2nd call: forecast
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            current: {
              temperature_2m: 31.0,
              relative_humidity_2m: 80,
              weather_code: 61, // Rain
            },
            daily: {
              time: ['2026-10-12'],
              temperature_2m_max: [33.0],
              temperature_2m_min: [26.0],
              precipitation_probability_max: [85],
              precipitation_sum: [12.0],
            },
          }),
        });
      globalThis.fetch = mockFetch as any;

      const weather = await fetchWeatherForLocation('Mumbai');
      expect(weather).toBeDefined();
      expect(weather?.locationName).toBe('Mumbai, India');
      expect(weather?.temperatureC).toBe(31);
      expect(weather?.weatherDescription).toBe('Rain');
      expect(weather?.precipitationProbabilityPercent).toBe(85);
    });

    it('gracefully returns null if weather forecast endpoint fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      globalThis.fetch = mockFetch as any;

      const weather = await fetchWeatherForLocation(undefined, { latitude: 20, longitude: 70 });
      expect(weather).toBeNull();
    });
  });
});
