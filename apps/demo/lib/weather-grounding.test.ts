import { describe, expect, it, vi } from "vitest";
import {
  extractWeatherLocation,
  retrieveOpenMeteoGrounding,
} from "./weather-grounding";
import { resolveContextualEvidenceRequest } from "@fify/core";

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}

describe("Open-Meteo evidence adapter", () => {
  it("extracts locations from common weather requests", () => {
    expect(extractWeatherLocation("what's the weather now in shanghai")).toBe(
      "shanghai",
    );
    expect(extractWeatherLocation("Will it rain tomorrow in Paris?")).toBe(
      "Paris",
    );
    expect(extractWeatherLocation("Tokyo forecast tomorrow")).toBe("Tokyo");
  });

  it("prefers the latest location in contextual weather follow-ups", () => {
    const shanghai = resolveContextualEvidenceRequest("What about Shanghai?", [
      "Tell me about the weather in Beijing right now",
    ]);
    expect(extractWeatherLocation(shanghai.prompt)).toBe("Shanghai");

    const confirmed = resolveContextualEvidenceRequest("Do it", [
      "Tell me about the weather in Beijing right now",
      "What about Shanghai?",
    ]);
    expect(extractWeatherLocation(confirmed.prompt)).toBe("Shanghai");
  });

  it("normalizes structured weather data into the shared grounding contract", async () => {
    const fetchImplementation = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("geocoding-api"))
        return json({
          results: [
            {
              name: "Shanghai",
              country: "China",
              latitude: 31.23,
              longitude: 121.47,
            },
          ],
        });
      return json({
        current: {
          time: "2026-08-24T14:45",
          temperature_2m: 31.4,
          apparent_temperature: 36.2,
          weather_code: 2,
          wind_speed_10m: 12.5,
          precipitation: 0,
        },
        daily: {
          time: ["2026-08-24", "2026-08-25"],
          weather_code: [2, 61],
          temperature_2m_max: [34, 32],
          temperature_2m_min: [27, 26],
          precipitation_probability_max: [20, 70],
          uv_index_max: [8, 6],
        },
      });
    });

    const result = await retrieveOpenMeteoGrounding({
      prompt: "What's the weather now in Shanghai?",
      fetchImplementation,
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(result.inputTokens).toBe(0);
    expect(result.packet.envelope.groundedAnswer).toContain("31.4°C");
    expect(result.packet.envelope.sources[0]).toMatchObject({
      title: "Open-Meteo live forecast for Shanghai, China",
    });
    expect(result.packet.envelope.sources[0]?.url).toContain(
      "api.open-meteo.com/v1/forecast",
    );
    expect(result.packet.envelope.sections).toHaveLength(1);
  });

  it("adds only requested forecast scope", async () => {
    const fetchImplementation = vi.fn(async (input: string | URL | Request) =>
      String(input).includes("geocoding-api")
        ? json({
            results: [
              {
                name: "Paris",
                country: "France",
                latitude: 48.86,
                longitude: 2.35,
              },
            ],
          })
        : json({
            current: {
              time: "2026-08-24T08:00",
              temperature_2m: 20,
              apparent_temperature: 20,
              weather_code: 3,
              wind_speed_10m: 8,
              precipitation: 0,
            },
            daily: {
              time: ["2026-08-24", "2026-08-25"],
              weather_code: [3, 61],
              temperature_2m_max: [24, 22],
              temperature_2m_min: [16, 15],
              precipitation_probability_max: [20, 70],
              uv_index_max: [5, 3],
            },
          }),
    );
    const result = await retrieveOpenMeteoGrounding({
      prompt: "Will it rain tomorrow in Paris?",
      fetchImplementation,
    });
    expect(result.packet.envelope.sections[1]?.items).toHaveLength(1);
    expect(result.packet.envelope.sections[1]?.items[0]?.label).toContain(
      "Aug 25",
    );
  });
});
