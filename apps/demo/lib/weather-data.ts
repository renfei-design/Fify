export type WeatherSource = "live" | "sample";

export interface WeatherHour {
  time: string;
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  windSpeed: number;
  weatherCode: number;
}

export interface WeatherDay {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
}

export interface WeatherPayload {
  source: WeatherSource;
  location: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  current: {
    time: string;
    temperature: number;
    apparentTemperature: number;
    precipitation: number;
    windSpeed: number;
    weatherCode: number;
  };
  hourly: WeatherHour[];
  daily: WeatherDay[];
  fetchedAt: string;
}

export interface WeatherGuidanceItem {
  label: string;
  detail: string;
  tone: "neutral" | "good" | "watch" | "critical";
}

export interface WeatherDecision {
  bestHour: WeatherHour;
  fitScore: number;
  verdict: string;
  summary: string;
  guidance: WeatherGuidanceItem[];
  alerts: WeatherGuidanceItem[];
}

export interface WeatherWindowOption {
  start: string;
  end: string;
  fitScore: number;
  temperatureMin: number;
  temperatureMax: number;
  precipitationProbability: number;
  windSpeed: number;
  weatherCode: number;
  summary: string;
}

const baseTime = "2026-08-18";

export const sampleWeather: WeatherPayload = {
  source: "sample",
  location: {
    name: "Shanghai",
    country: "China",
    latitude: 31.23,
    longitude: 121.47,
    timezone: "Asia/Shanghai",
  },
  current: {
    time: `${baseTime}T07:30`,
    temperature: 27,
    apparentTemperature: 31,
    precipitation: 0,
    windSpeed: 11,
    weatherCode: 2,
  },
  hourly: Array.from({ length: 42 }, (_, index) => {
    const absoluteHour = 6 + index;
    const hour = absoluteHour % 24;
    const day = 18 + Math.floor(absoluteHour / 24);
    const rain = hour < 9 ? 12 : hour < 15 ? 28 : hour < 19 ? 64 : 36;
    return {
      time: `2026-08-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`,
      temperature: Math.round(25 + Math.sin((hour - 6) / 17 * Math.PI) * 8),
      apparentTemperature: Math.round(28 + Math.sin((hour - 6) / 17 * Math.PI) * 9),
      precipitationProbability: rain,
      windSpeed: hour < 16 ? 10 + (hour % 4) : 18,
      weatherCode: rain > 55 ? 61 : hour < 10 ? 2 : 3,
    };
  }),
  daily: [
    { date: "2026-08-18", weatherCode: 61, temperatureMax: 33, temperatureMin: 25, precipitationProbability: 64, sunrise: "2026-08-18T05:20", sunset: "2026-08-18T18:31", uvIndexMax: 8.1 },
    { date: "2026-08-19", weatherCode: 3, temperatureMax: 32, temperatureMin: 24, precipitationProbability: 31, sunrise: "2026-08-19T05:21", sunset: "2026-08-19T18:30", uvIndexMax: 7.4 },
    { date: "2026-08-20", weatherCode: 2, temperatureMax: 34, temperatureMin: 25, precipitationProbability: 18, sunrise: "2026-08-20T05:22", sunset: "2026-08-20T18:29", uvIndexMax: 8.6 },
    { date: "2026-08-21", weatherCode: 80, temperatureMax: 31, temperatureMin: 25, precipitationProbability: 72, sunrise: "2026-08-21T05:22", sunset: "2026-08-21T18:28", uvIndexMax: 6.8 },
    { date: "2026-08-22", weatherCode: 1, temperatureMax: 35, temperatureMin: 26, precipitationProbability: 14, sunrise: "2026-08-22T05:23", sunset: "2026-08-22T18:27", uvIndexMax: 9.0 },
  ],
  fetchedAt: new Date().toISOString(),
};

export function upcomingWeatherHours(weather: WeatherPayload, limit = 12): WeatherHour[] {
  const current = weather.current.time.slice(0, 13);
  const result = weather.hourly.filter((hour) => hour.time.slice(0, 13) >= current).slice(0, limit);
  return result.length >= Math.min(6, limit) ? result : weather.hourly.slice(0, limit);
}

function hourRisk(hour: WeatherHour): number {
  return hour.precipitationProbability
    + Math.max(0, hour.windSpeed - 14) * 2
    + Math.max(0, hour.apparentTemperature - 30) * 3;
}

function hoursForScope(weather: WeatherPayload, timeScope: string): WeatherHour[] {
  const scope = timeScope.toLocaleLowerCase("en");
  const currentDate = weather.current.time.slice(0, 10);
  const tomorrow = weather.daily.find((day) => day.date > currentDate)?.date;
  const namedDay = weather.daily.find((day) => (
    scope.includes(new Date(`${day.date}T12:00`).toLocaleDateString("en", { weekday: "long" }).toLocaleLowerCase("en"))
  ))?.date;
  const targetDate = scope.includes("tomorrow") ? tomorrow
    : scope.includes("today") ? currentDate
      : namedDay;
  let hours = weather.hourly.filter((hour) => !targetDate || hour.time.startsWith(targetDate));
  if (scope.includes("morning")) hours = hours.filter((hour) => Number(hour.time.slice(11, 13)) >= 6 && Number(hour.time.slice(11, 13)) < 12);
  else if (scope.includes("afternoon")) hours = hours.filter((hour) => Number(hour.time.slice(11, 13)) >= 12 && Number(hour.time.slice(11, 13)) < 18);
  else if (scope.includes("evening")) hours = hours.filter((hour) => Number(hour.time.slice(11, 13)) >= 17 && Number(hour.time.slice(11, 13)) < 23);
  else hours = hours.filter((hour) => Number(hour.time.slice(11, 13)) >= 8 && Number(hour.time.slice(11, 13)) < 22);
  return hours.length ? hours : upcomingWeatherHours(weather, 36);
}

function localIsoMinute(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function deriveWeatherWindowOptions(
  weather: WeatherPayload,
  options: { windowHours: number; limit: number; timeScope?: string },
): WeatherWindowOption[] {
  const windowHours = Math.min(12, Math.max(1, Math.round(options.windowHours)));
  const limit = Math.min(4, Math.max(2, Math.round(options.limit)));
  const hours = hoursForScope(weather, options.timeScope ?? "");
  const candidates: Array<WeatherWindowOption & { risk: number; startMs: number }> = [];

  for (let index = 0; index <= hours.length - windowHours; index += 1) {
    const window = hours.slice(index, index + windowHours);
    const startMs = new Date(window[0]!.time).getTime();
    const endMs = new Date(window.at(-1)!.time).getTime();
    if (endMs - startMs !== (windowHours - 1) * 60 * 60 * 1000) continue;
    const precipitationProbability = Math.max(...window.map((hour) => hour.precipitationProbability));
    const windSpeed = Math.max(...window.map((hour) => hour.windSpeed));
    const temperatureMin = Math.min(...window.map((hour) => hour.temperature));
    const temperatureMax = Math.max(...window.map((hour) => hour.temperature));
    const apparentMax = Math.max(...window.map((hour) => hour.apparentTemperature));
    const risk = precipitationProbability * 0.65
      + Math.max(0, windSpeed - 14) * 1.4
      + Math.max(0, apparentMax - 30) * 1.6;
    const fitScore = Math.min(100, Math.max(10, Math.round(100 - risk)));
    const weatherCode = window.reduce((mostRelevant, hour) => (
      hourRisk(hour) > hourRisk(mostRelevant) ? hour : mostRelevant
    ), window[0]!).weatherCode;
    const summary = precipitationProbability >= 50
      ? "Rain is the main tradeoff for this window."
      : windSpeed >= 25
        ? "Wind exposure is the main tradeoff for this window."
        : fitScore >= 80
          ? "The strongest balance of dry, calm conditions."
          : "A workable backup with manageable weather tradeoffs.";
    candidates.push({
      start: window[0]!.time,
      end: localIsoMinute(endMs + 60 * 60 * 1000),
      fitScore,
      temperatureMin,
      temperatureMax,
      precipitationProbability,
      windSpeed,
      weatherCode,
      summary,
      risk,
      startMs,
    });
  }

  candidates.sort((a, b) => a.risk - b.risk || a.startMs - b.startMs);
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (selected.every((choice) => Math.abs(choice.startMs - candidate.startMs) >= windowHours * 60 * 60 * 1000)) selected.push(candidate);
    if (selected.length >= limit) break;
  }
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }
  return selected.map(({ risk: _risk, startMs: _startMs, ...option }) => option);
}

export function deriveWeatherDecision(weather: WeatherPayload): WeatherDecision {
  const hours = upcomingWeatherHours(weather);
  const fallbackHour: WeatherHour = {
    time: weather.current.time,
    temperature: weather.current.temperature,
    apparentTemperature: weather.current.apparentTemperature,
    precipitationProbability: 0,
    windSpeed: weather.current.windSpeed,
    weatherCode: weather.current.weatherCode,
  };
  const bestHour = hours.reduce(
    (winner, hour) => hourRisk(hour) < hourRisk(winner) ? hour : winner,
    hours[0] ?? fallbackHour,
  );
  const fitScore = Math.min(100, Math.max(10, Math.round(
    100
      - bestHour.precipitationProbability * 0.65
      - Math.max(0, bestHour.windSpeed - 14) * 1.4
      - Math.max(0, bestHour.apparentTemperature - 30) * 1.6,
  )));
  const verdict = fitScore >= 75
    ? "Strongest weather window"
    : fitScore >= 50
      ? "Usable with adjustments"
      : "Conditions need caution";
  const summary = `The lowest-risk bound hour scores ${fitScore}/100 with ${Math.round(bestHour.precipitationProbability)}% rain probability and ${Math.round(bestHour.windSpeed)} km/h wind.`;

  const days = weather.daily.slice(0, 5);
  const peakRain = Math.max(0, ...days.map((day) => day.precipitationProbability));
  const peakUv = Math.max(0, ...days.map((day) => day.uvIndexMax));
  const peakTemperature = Math.max(weather.current.temperature, ...days.map((day) => day.temperatureMax));
  const minimumTemperature = Math.min(weather.current.temperature, ...days.map((day) => day.temperatureMin));
  const peakWind = Math.max(weather.current.windSpeed, ...hours.map((hour) => hour.windSpeed));
  const guidance: WeatherGuidanceItem[] = [];

  if (peakRain >= 40) guidance.push({
    label: "Rain protection",
    detail: `Peak daily rain probability reaches ${Math.round(peakRain)}%; pack a waterproof layer or umbrella.`,
    tone: peakRain >= 65 ? "critical" : "watch",
  });
  if (peakTemperature >= 30) guidance.push({
    label: "Heat plan",
    detail: `The bound forecast reaches ${Math.round(peakTemperature)}°C; plan water, shade, and breaks.`,
    tone: peakTemperature >= 35 ? "critical" : "watch",
  });
  if (minimumTemperature <= 12) guidance.push({
    label: "Warm layer",
    detail: `The bound forecast falls to ${Math.round(minimumTemperature)}°C; bring an adaptable layer.`,
    tone: minimumTemperature <= 5 ? "critical" : "watch",
  });
  if (peakUv >= 6) guidance.push({
    label: "Sun protection",
    detail: `UV reaches ${peakUv.toFixed(1)}; include shade, sunscreen, and eye protection.`,
    tone: peakUv >= 8 ? "critical" : "watch",
  });
  if (peakWind >= 25) guidance.push({
    label: "Wind exposure",
    detail: `Wind reaches ${Math.round(peakWind)} km/h in the bound window; secure loose items.`,
    tone: peakWind >= 40 ? "critical" : "watch",
  });
  if (guidance.length === 0) guidance.push({
    label: "Routine preparation",
    detail: "No configured rain, heat, cold, UV, or wind guidance threshold is elevated.",
    tone: "good",
  });

  const alerts = guidance.filter((item) => item.tone === "critical");
  return { bestHour, fitScore, verdict, summary, guidance: guidance.slice(0, 4), alerts };
}

export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}

export function weatherGlyph(code: number): string {
  if (code === 0) return "☀";
  if (code <= 2) return "◒";
  if (code <= 48) return "≋";
  if (code <= 67) return "╱╱";
  if (code <= 77) return "✳";
  if (code <= 86) return "☂";
  return "ϟ";
}
