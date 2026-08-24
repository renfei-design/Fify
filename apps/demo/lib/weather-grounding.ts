import {
  informationEnvelopeV1Schema,
  type EvidenceProvider,
  type EvidenceProviderResult,
} from "@fify/core";

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The weather provider returned an invalid payload.");
  return value as Record<string, unknown>;
}

function finite(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`The weather provider omitted ${label}.`);
  return value;
}

function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`The weather provider omitted ${label}.`);
  return value;
}

function numberArray(value: unknown, label: string) {
  if (!Array.isArray(value))
    throw new Error(`The weather provider omitted ${label}.`);
  return value.map((item) => finite(item, label));
}

function stringArray(value: unknown, label: string) {
  if (!Array.isArray(value))
    throw new Error(`The weather provider omitted ${label}.`);
  return value.map((item) => text(item, label));
}

function weatherDescription(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed conditions";
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

/** Extracts an explicit location without spending a model call. */
export function extractWeatherLocation(prompt: string) {
  const contextual = prompt.match(
    /\b(?:(?:what|how)\s+about|same(?:\s+thing)?\s+for)\s+([\p{L}\p{M}\d .,'’()-]{2,80}?)(?=[?!.;,\n]|$)/iu,
  )?.[1];
  if (contextual) return contextual.trim();
  const suffix = prompt.match(
    /\b(?:in|for|at|near)\s+([\p{L}\p{M}\d .,'’()-]{2,80}?)(?=\s+(?:right\s+now|now|today|tonight|tomorrow|this\s+week|this\s+weekend|for\s+the\s+next|over\s+the\s+next)|[?!.;,]|$)/iu,
  )?.[1];
  if (suffix) return suffix.trim();
  const prefix = prompt.match(
    /^([\p{L}\p{M}\d .,'’()-]{2,60}?)\s+(?:weather|forecast|temperature)\b/iu,
  )?.[1];
  return prefix?.trim() ?? null;
}

async function fetchJson(
  fetchImplementation: FetchImplementation,
  url: URL,
  signal?: AbortSignal,
) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(new DOMException("Timed out", "AbortError")),
    5_000,
  );
  const abort = () => timeoutController.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetchImplementation(url, {
      signal: timeoutController.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(`The weather provider returned HTTP ${response.status}.`);
    return record(await response.json());
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function retrieveOpenMeteoGrounding(input: {
  prompt: string;
  signal?: AbortSignal;
  fetchImplementation?: FetchImplementation;
}): Promise<EvidenceProviderResult> {
  const locationQuery = extractWeatherLocation(input.prompt);
  if (!locationQuery)
    throw new Error("A specific location is required for live weather.");
  const fetchImplementation = input.fetchImplementation ?? fetch;

  const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodeUrl.search = new URLSearchParams({
    name: locationQuery,
    count: "1",
    language: "en",
    format: "json",
  }).toString();
  const geocode = await fetchJson(
    fetchImplementation,
    geocodeUrl,
    input.signal,
  );
  const place = Array.isArray(geocode.results)
    ? record(geocode.results[0])
    : null;
  if (!place)
    throw new Error(`No weather location matched '${locationQuery}'.`);

  const latitude = finite(place.latitude, "latitude");
  const longitude = finite(place.longitude, "longitude");
  const placeName = text(place.name, "place name");
  const country = typeof place.country === "string" ? place.country : "";
  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max",
    timezone: "auto",
    forecast_days: "7",
  }).toString();
  const forecast = await fetchJson(
    fetchImplementation,
    forecastUrl,
    input.signal,
  );
  const current = record(forecast.current);
  const currentTime = text(current.time, "observation time");
  const temperature = round(finite(current.temperature_2m, "temperature"));
  const apparent = round(
    finite(current.apparent_temperature, "apparent temperature"),
  );
  const weatherCode = finite(current.weather_code, "weather code");
  const precipitation = round(finite(current.precipitation, "precipitation"));
  const wind = round(finite(current.wind_speed_10m, "wind speed"));
  const condition = weatherDescription(weatherCode);
  const locationLabel = country ? `${placeName}, ${country}` : placeName;
  const sourceId = "source-open-meteo";
  const wantsForecast =
    /\b(?:forecast|tomorrow|next|week|weekend|later|tonight|will)\b/i.test(
      input.prompt,
    );

  const sections = [
    {
      id: "current-conditions",
      title: `Weather now in ${placeName}`,
      body: `${condition}, ${temperature}°C. It feels like ${apparent}°C.`,
      sourceIds: [sourceId],
      items: [
        {
          id: "temperature",
          label: "Temperature",
          value: `${temperature}°C`,
          detail: `Feels like ${apparent}°C`,
          sourceIds: [sourceId],
        },
        {
          id: "conditions",
          label: "Conditions",
          value: condition,
          detail: `${precipitation} mm precipitation · ${wind} km/h wind`,
          sourceIds: [sourceId],
        },
      ],
    },
  ];

  if (wantsForecast) {
    const daily = record(forecast.daily);
    const dates = stringArray(daily.time, "daily dates");
    const maximums = numberArray(daily.temperature_2m_max, "daily highs");
    const minimums = numberArray(daily.temperature_2m_min, "daily lows");
    const codes = numberArray(daily.weather_code, "daily weather codes");
    const rain = numberArray(
      daily.precipitation_probability_max,
      "daily rain probability",
    );
    const uv = numberArray(daily.uv_index_max, "daily UV index");
    const startIndex = /\btomorrow\b/i.test(input.prompt) ? 1 : 0;
    const countMatch = input.prompt.match(/\bnext\s+(\d+)\s+days?\b/i);
    const count = countMatch
      ? Math.min(7, Math.max(1, Number(countMatch[1])))
      : /\b(?:week|weekend)\b/i.test(input.prompt)
        ? 5
        : 1;
    const items = dates
      .slice(startIndex, startIndex + count)
      .map((date, offset) => {
        const index = startIndex + offset;
        const label = new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${date}T12:00:00Z`));
        return {
          id: `forecast-${date}`,
          label,
          value: `${round(minimums[index]!)}–${round(maximums[index]!)}°C`,
          detail: `${weatherDescription(codes[index]!)} · ${Math.round(rain[index]!)}% rain · UV ${round(uv[index]!)}`,
          sourceIds: [sourceId],
        };
      });
    if (items.length)
      sections.push({
        id: "forecast",
        title: items.length === 1 ? "Forecast" : "Daily forecast",
        body: "The most decision-relevant forecast details.",
        sourceIds: [sourceId],
        items,
      });
  }

  const fetchedAt = new Date().toISOString();
  return {
    packet: {
      asOf: fetchedAt,
      toolCalls: 1,
      envelope: informationEnvelopeV1Schema.parse({
        version: "1.0",
        originalRequest: input.prompt,
        groundedAnswer: `${locationLabel}: ${condition}, ${temperature}°C as of ${currentTime} local time. It feels like ${apparent}°C, with ${precipitation} mm precipitation and ${wind} km/h wind.`,
        locale: "en-US",
        sections,
        sources: [
          {
            id: sourceId,
            title: `Open-Meteo live forecast for ${locationLabel}`,
            url: forecastUrl.toString(),
          },
        ],
        suggestedRefinements: [],
      }),
    },
    inputTokens: 0,
    outputTokens: 0,
  };
}

export function createOpenMeteoEvidenceProvider(
  fetchImplementation: FetchImplementation = fetch,
): EvidenceProvider {
  return {
    id: "open-meteo",
    kind: "structured-data",
    capabilities: ["weather"],
    resolve: ({ prompt, signal }) =>
      retrieveOpenMeteoGrounding({
        prompt,
        ...(signal ? { signal } : {}),
        fetchImplementation,
      }),
  };
}
