import { describe, expect, it } from "vitest";
import {
  deriveWeatherDecision,
  deriveWeatherWindowOptions,
  sampleWeather,
  upcomingWeatherHours,
  type WeatherPayload,
} from "./weather-data";

describe("trusted weather decision derivation", () => {
  it("derives its decision and guidance from bound weather data", () => {
    const decision = deriveWeatherDecision(sampleWeather);

    expect(upcomingWeatherHours(sampleWeather)).toContainEqual(decision.bestHour);
    expect(decision.fitScore).toBeGreaterThanOrEqual(10);
    expect(decision.fitScore).toBeLessThanOrEqual(100);
    expect(decision.summary).toContain(`${Math.round(decision.bestHour.precipitationProbability)}%`);
    expect(decision.guidance).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Rain protection" }),
      expect.objectContaining({ label: "Heat plan" }),
      expect.objectContaining({ label: "Sun protection" }),
    ]));
  });

  it("changes factual guidance when the bound forecast changes", () => {
    const mild: WeatherPayload = {
      ...sampleWeather,
      current: { ...sampleWeather.current, temperature: 20, apparentTemperature: 20, windSpeed: 8 },
      hourly: sampleWeather.hourly.map((hour) => ({
        ...hour,
        temperature: 20,
        apparentTemperature: 20,
        precipitationProbability: 5,
        windSpeed: 8,
      })),
      daily: sampleWeather.daily.map((day) => ({
        ...day,
        temperatureMax: 24,
        temperatureMin: 17,
        precipitationProbability: 8,
        uvIndexMax: 4,
      })),
    };

    expect(deriveWeatherDecision(mild).guidance).toEqual([{
      label: "Routine preparation",
      detail: "No configured rain, heat, cold, UV, or wind guidance threshold is elevated.",
      tone: "good",
    }]);
  });

  it("still returns a data-bound decision when hourly data is unavailable", () => {
    const decision = deriveWeatherDecision({ ...sampleWeather, hourly: [] });

    expect(decision.bestHour.time).toBe(sampleWeather.current.time);
    expect(decision.summary).toContain(`${Math.round(sampleWeather.current.windSpeed)} km/h`);
  });

  it("ranks several comparable fixed-duration windows from bound hourly data", () => {
    const options = deriveWeatherWindowOptions(sampleWeather, {
      windowHours: 3,
      limit: 3,
      timeScope: "today",
    });

    expect(options).toHaveLength(3);
    expect(options[0]!.fitScore).toBeGreaterThanOrEqual(options[1]!.fitScore);
    expect(options.every((option) => option.end > option.start)).toBe(true);
    expect(options.every((option) => option.summary.length > 0)).toBe(true);
  });
});
