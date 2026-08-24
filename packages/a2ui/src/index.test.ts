import { describe, expect, it } from "vitest";
import { decodeJsonLines, parseA2UIMessage, reduceA2UIMessage, reduceA2UIMessages, reduceA2UIStream, type A2UIMessage } from "./index.js";

describe("A2UI surface reducer", () => {
  const create: A2UIMessage = {
    version: "v1.0",
    createSurface: {
      surfaceId: "weather-main",
      catalogId: "https://fify.dev/catalogs/weather/0.1",
      components: [
        { id: "root", component: "Column", children: ["forecast"] },
        { id: "forecast", component: "HourlyTimeline", limit: 24 },
      ],
      dataModel: { location: "Shanghai" },
    },
  };

  it("creates a surface from a spec-shaped message", () => {
    const state = reduceA2UIStream([create]);
    expect(state?.components.root).toMatchObject({ component: "Column", children: ["forecast"] });
    expect(state?.dataModel.location).toBe("Shanghai");
  });

  it("applies an updateDataModel message by JSON pointer", () => {
    const state = reduceA2UIStream([create]);
    const updated = reduceA2UIMessage(state, {
      version: "v1.0",
      updateDataModel: { surfaceId: "weather-main", path: "/location", value: "Beijing" },
    });
    expect(updated?.dataModel.location).toBe("Beijing");
  });

  it("rejects malformed envelopes and permits a root to arrive progressively", () => {
    expect(() => parseA2UIMessage({ version: "v1.0", createSurface: { surfaceId: "main" }, extra: true })).toThrow();
    const progressive = reduceA2UIStream([{
      version: "v1.0",
      createSurface: { surfaceId: "main", components: [{ id: "card", component: "Card" }] },
    }]);
    expect(progressive?.components.card?.component).toBe("Card");
  });

  it("applies a sequence of incremental messages to an existing surface", () => {
    const state = reduceA2UIStream([create]);
    const updated = reduceA2UIMessages(state, [
      { version: "v1.0", updateComponents: { surfaceId: "weather-main", components: [{ id: "root", component: "Column", children: ["forecast", "alerts"] }, { id: "alerts", component: "WeatherAlerts" }] } },
      { version: "v1.0", updateDataModel: { surfaceId: "weather-main", path: "/location", value: "Tokyo" } },
    ]);
    expect(updated?.components.root?.children).toEqual(["forecast", "alerts"]);
    expect(updated?.dataModel.location).toBe("Tokyo");
  });

  it("decodes JSON Lines split across arbitrary network chunks", async () => {
    const encoder = new TextEncoder();
    const chunks = ["{\"step\":1}\n{\"st", "ep\":2}\n", "{\"step\":3}"];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    const values: Array<{ step: number }> = [];
    for await (const value of decodeJsonLines<{ step: number }>(stream)) values.push(value);
    expect(values).toEqual([{ step: 1 }, { step: 2 }, { step: 3 }]);
  });
});
