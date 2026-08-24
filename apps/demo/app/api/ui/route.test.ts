import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { decodeJsonLines } from "@fify/a2ui";
import { uiLanguageFixture } from "@fify/core";
import {
  parseUniversalGenerationStreamFrame,
  type UniversalGenerationStreamFrame,
} from "../../../lib/universal-generation-stream";
import { universalRunStore } from "../../../lib/universal-run-store";
import { GET, POST } from "./route";

async function frames(response: Response) {
  const result: UniversalGenerationStreamFrame[] = [];
  if (response.body)
    for await (const frame of decodeJsonLines(
      response.body,
      parseUniversalGenerationStreamFrame,
    ))
      result.push(frame);
  return result;
}

function modelResponse(value: unknown) {
  const output = JSON.stringify(value);
  const cuts = [
    Math.floor(output.length * 0.3),
    Math.floor(output.length * 0.65),
  ];
  const chunks = [
    output.slice(0, cuts[0]),
    output.slice(cuts[0], cuts[1]),
    output.slice(cuts[1]),
  ];
  const events = [
    {
      type: "response.reasoning_summary_text.delta",
      delta: "Choosing a concise structure for the requested interface.",
    },
    {
      type: "response.reasoning_summary_text.done",
      text: "Choosing a concise structure for the requested interface.",
    },
    ...chunks.map((delta) => ({ type: "response.output_text.delta", delta })),
    {
      type: "response.completed",
      response: {
        id: "response-universal",
        model: "test-model",
        usage: { input_tokens: 120, output_tokens: 240 },
      },
    },
  ];
  return new Response(
    events
      .map(
        (event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      )
      .join(""),
    { headers: { "content-type": "text/event-stream" } },
  );
}

function plannerResponse(value: unknown) {
  return new Response(
    JSON.stringify({
      id: "response-route",
      model: "test-model",
      usage: { input_tokens: 40, output_tokens: 60 },
      output: [
        { content: [{ type: "output_text", text: JSON.stringify(value) }] },
      ],
    }),
    { headers: { "content-type": "application/json" } },
  );
}

function groundingResponse(value: unknown) {
  return new Response(
    JSON.stringify({
      id: "response-grounding",
      model: "test-model",
      usage: { input_tokens: 30, output_tokens: 40 },
      output: [
        {
          type: "web_search_call",
          status: "completed",
          action: {
            type: "search",
            sources: [
              {
                title: "Official current report",
                url: "https://example.com/current-report",
              },
            ],
          },
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(value),
              annotations: [
                {
                  type: "url_citation",
                  title: "Official current report",
                  url: "https://example.com/current-report",
                },
              ],
            },
          ],
        },
      ],
    }),
    { headers: { "content-type": "application/json" } },
  );
}

const directPlan = {
  version: "1.0",
  mode: "blueprint",
  blueprintIds: ["direct-answer"],
  confidence: 0.94,
  userJob: "answer the question directly",
  informationShapes: ["narrative"],
  interactionLevel: "read",
  scale: "atomic",
  topology: "editorial-stack",
  noveltyBudget: 0.2,
  slots: [
    {
      id: "answer",
      role: "answer",
      shape: "narrative",
      priority: "primary",
      required: true,
    },
  ],
};

function decisionFor(
  plan: typeof directPlan | Record<string, unknown>,
  options: {
    attentionMode?: "glance" | "read" | "explore" | "work";
    obligations?: unknown[];
    primarySubject?: string;
  } = {},
) {
  const representation = plan as typeof directPlan;
  const primarySlot =
    representation.slots.find((slot) => slot.priority === "primary") ??
    representation.slots[0]!;
  return {
    version: "1.0",
    userOutcome: representation.userJob,
    primarySubject: options.primarySubject ?? "",
    audience: "general",
    attentionMode:
      options.attentionMode ??
      (representation.scale === "atomic" ? "glance" : "read"),
    disclosureStrategy: "none",
    latencyTier: "standard",
    compositionIntent:
      "Lead with the direct answer and add only necessary support.",
    confidence: representation.confidence,
    representation,
    contentObligations: (
      options.obligations ?? [
        {
          id: "primary-answer",
          slotId: primarySlot.id,
          purpose: representation.userJob,
          shape: primarySlot.shape,
          priority: "primary",
          mediaQuery: "",
        },
      ]
    ).map((obligation) => ({
      itemCount: null,
      ...(obligation as Record<string, unknown>),
    })),
    contentBudget: {
      maxVisibleNodes: representation.scale === "atomic" ? 2 : 4,
      maxItemsPerNode: 8,
      maxVisibleCopyCharacters: 1_400,
    },
  };
}

function directExperience(responseId: string) {
  return {
    version: "4.0",
    responseId,
    goal: "Answer clearly",
    suggestions: [],
    screen: { title: "Answer", contextLabel: "Direct" },
    nodes: [
      {
        id: "root",
        type: "Page",
        slot: "",
        importance: "supporting",
        relationship: "standalone",
        mediaRole: "none",
        align: "start",
        columns: 1,
        gap: "normal",
        children: ["answer"],
      },
      {
        id: "answer",
        type: "Text",
        slot: "answer",
        importance: "primary",
        relationship: "standalone",
        mediaRole: "none",
        title: "A focused answer",
        text: "The interface contains only the information needed for this request.",
        label: "Answer",
        value: "",
        meta: "",
      },
    ],
  };
}

function invalidExperience(responseId: string) {
  return {
    version: "4.0",
    responseId,
    goal: "This graph is intentionally invalid",
    suggestions: [],
    screen: { title: "Invalid", contextLabel: "Test" },
    nodes: [],
  };
}

function twoStageFetch(plan: unknown, experience: unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.includes("api.openai.com"))
      return new Response(null, { status: 404 });
    const payload = JSON.parse(String(init?.body ?? "{}")) as {
      stream?: boolean;
    };
    return payload.stream
      ? modelResponse(experience)
      : plannerResponse(decisionFor(plan as Record<string, unknown>));
  });
}

afterEach(() => {
  universalRunStore.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("universal UI generation route", () => {
  it("reports configuration and fails closed without a model", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect((await GET()).json()).resolves.toMatchObject({
      configured: false,
      medium: "ui-language-v4",
      transport: "a2ui",
    });
    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        body: JSON.stringify({ prompt: "Explain gravity" }),
      }),
    );
    expect(response.status).toBe(428);
  });

  it("streams a cross-domain UI graph as progressive A2UI", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const experience = directExperience("compound-test");
    vi.stubGlobal("fetch", twoStageFetch(directPlan, experience));
    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Explain compound interest for this test",
        }),
      }),
    );
    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson",
    );
    const streamed = await frames(response);
    expect(response.headers.get("x-fify-run-id")).toBe(streamed[0]?.runId);
    expect(streamed.map((frame) => frame.sequence)).toEqual(
      streamed.map((_, index) => index + 1),
    );
    expect(streamed[0]).toMatchObject({ type: "status", phase: "accepted" });
    expect(
      streamed.some(
        (frame) => frame.type === "a2ui" && "createSurface" in frame.message,
      ),
    ).toBe(true);
    expect(
      streamed.some(
        (frame) =>
          frame.type === "activity" &&
          frame.source === "provider" &&
          frame.detail?.includes("concise structure"),
      ),
    ).toBe(true);
    expect(
      streamed.filter(
        (frame) => frame.type === "a2ui" && "updateComponents" in frame.message,
      ).length,
    ).toBeGreaterThanOrEqual(experience.nodes.length);
    expect(
      streamed.some(
        (frame) =>
          frame.type === "status" &&
          frame.phase === "composing" &&
          frame.state === "started" &&
          frame.completedUnits === 0 &&
          Number(frame.totalUnits) > 0,
      ),
    ).toBe(true);
    expect(
      streamed.some(
        (frame) =>
          frame.type === "status" &&
          frame.phase === "composing" &&
          frame.state === "advanced" &&
          Number(frame.completedUnits) > 0 &&
          frame.unit === "regions",
      ),
    ).toBe(true);
    expect(streamed.find((frame) => frame.type === "complete")).toMatchObject({
      type: "complete",
      experience: { responseId: "compound-test" },
      meta: {
        model: "test-model",
        streaming: {
          firstSurfaceFrameMs: expect.any(Number),
          firstRepresentationFrameMs: expect.any(Number),
          firstContentFrameMs: expect.any(Number),
          visibleContentFrames: expect.any(Number),
          maxVisibleFrameGapMs: expect.any(Number),
        },
      },
    });
  });

  it("searches current facts, grounds composition, and appends clickable sources", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const prompt =
      "What is the latest test result today? unique grounding route";
    const experience = directExperience("grounded-route-test");
    const draft = {
      version: "1.0",
      asOf: new Date().toISOString(),
      answer: "The latest test result is verified.",
      locale: "en-US",
      sections: [
        {
          id: "latest-result",
          title: "Latest result",
          body: "A verified current result.",
          sourceUrls: ["https://example.com/current-report"],
          items: [],
        },
      ],
      sources: [
        {
          title: "Official current report",
          url: "https://example.com/current-report",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          stream?: boolean;
          tools?: unknown[];
        };
        if (payload.tools) return groundingResponse(draft);
        return payload.stream
          ? modelResponse(experience)
          : plannerResponse(decisionFor(directPlan));
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      }),
    );
    const streamed = await frames(response);
    expect(
      streamed.some(
        (frame) => frame.type === "status" && frame.phase === "grounding",
      ),
    ).toBe(true);
    const complete = streamed.find((frame) => frame.type === "complete");
    expect(complete).toMatchObject({
      type: "complete",
      meta: {
        grounding: {
          mode: "required",
          searched: true,
          degraded: false,
          sourceCount: 1,
          toolCalls: 1,
        },
      },
    });
    if (complete?.type !== "complete") throw new Error("Missing completion");
    expect(complete.experience.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "Sources",
          items: [
            expect.objectContaining({
              detail: "https://example.com/current-report",
            }),
          ],
        }),
      ]),
    );
  });

  it("uses structured live data before web search for a matching capability", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const experience = directExperience("structured-weather-route-test");
    let webSearchCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("geocoding-api.open-meteo.com"))
          return new Response(
            JSON.stringify({
              results: [
                {
                  name: "Shanghai",
                  country: "China",
                  latitude: 31.23,
                  longitude: 121.47,
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          );
        if (url.includes("api.open-meteo.com/v1/forecast"))
          return new Response(
            JSON.stringify({
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
            }),
            { headers: { "content-type": "application/json" } },
          );
        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          stream?: boolean;
          tools?: unknown[];
        };
        if (payload.tools) webSearchCalls += 1;
        return payload.stream
          ? modelResponse(experience)
          : plannerResponse(decisionFor(directPlan));
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "what's the weather now in shanghai",
        }),
      }),
    );
    const streamed = await frames(response);
    const complete = streamed.find((frame) => frame.type === "complete");

    expect(webSearchCalls).toBe(0);
    expect(complete).toMatchObject({
      type: "complete",
      meta: {
        grounding: {
          mode: "required",
          providerId: "open-meteo",
          providerKind: "structured-data",
          fallbackUsed: false,
          sourceCount: 1,
          toolCalls: 1,
        },
      },
    });
    if (complete?.type !== "complete") throw new Error("Missing completion");
    expect(complete.experience.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "Sources",
          items: [
            expect.objectContaining({
              detail: expect.stringContaining("api.open-meteo.com/v1/forecast"),
            }),
          ],
        }),
      ]),
    );
  });

  it("routes an elliptical weather follow-up to structured data using its latest location", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const experience = directExperience("contextual-weather-route-test");
    const geocodingQueries: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("geocoding-api.open-meteo.com")) {
          geocodingQueries.push(new URL(url).searchParams.get("name") ?? "");
          return new Response(
            JSON.stringify({
              results: [
                {
                  name: "Shanghai",
                  country: "China",
                  latitude: 31.23,
                  longitude: 121.47,
                },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("api.open-meteo.com/v1/forecast"))
          return new Response(
            JSON.stringify({
              current: {
                time: "2026-08-24T14:45",
                temperature_2m: 31.4,
                apparent_temperature: 36.2,
                weather_code: 2,
                wind_speed_10m: 12.5,
                precipitation: 0,
              },
              daily: {
                time: ["2026-08-24"],
                weather_code: [2],
                temperature_2m_max: [34],
                temperature_2m_min: [27],
                precipitation_probability_max: [20],
                uv_index_max: [8],
              },
            }),
            { headers: { "content-type": "application/json" } },
          );
        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          stream?: boolean;
        };
        return payload.stream
          ? modelResponse(experience)
          : plannerResponse(decisionFor(directPlan));
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "What about Shanghai?",
          conversation: ["Tell me about the weather in Beijing right now"],
        }),
      }),
    );
    const streamed = await frames(response);
    const complete = streamed.find((frame) => frame.type === "complete");

    expect(geocodingQueries).toEqual(["Shanghai"]);
    expect(complete).toMatchObject({
      type: "complete",
      meta: {
        grounding: {
          mode: "required",
          providerId: "open-meteo",
          providerKind: "structured-data",
          degraded: false,
        },
      },
    });
  });

  it("replays only unseen frames without regenerating the interface", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const provider = twoStageFetch(
      directPlan,
      directExperience("replayed-interface"),
    );
    vi.stubGlobal("fetch", provider);
    const runId = "run-replay-1234";
    const requestBody = {
      prompt: "Explain replay checkpoints for this test",
      runId,
    };
    const firstResponse = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );
    const firstFrames = await frames(firstResponse);
    const checkpoint = firstFrames[Math.floor(firstFrames.length / 2)]!;
    const providerCalls = provider.mock.calls.length;

    const resumedResponse = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...requestBody,
          afterSequence: checkpoint.sequence,
        }),
      }),
    );
    const resumedFrames = await frames(resumedResponse);

    expect(resumedResponse.headers.get("x-fify-run-id")).toBe(runId);
    expect(resumedFrames.map((frame) => frame.sequence)).toEqual(
      firstFrames
        .filter((frame) => frame.sequence > checkpoint.sequence)
        .map((frame) => frame.sequence),
    );
    expect(
      resumedFrames.every(
        (frame) =>
          frame.runId === runId && frame.sequence > checkpoint.sequence,
      ),
    ).toBe(true);
    expect(resumedFrames.at(-1)).toMatchObject({ type: "complete", runId });
    expect(provider.mock.calls.length).toBe(providerCalls);
  });

  it("rejects expired and out-of-range replay checkpoints explicitly", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const expired = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Resume an expired run",
          runId: "run-expired-1234",
          afterSequence: 3,
        }),
      }),
    );
    expect(expired.status).toBe(410);
    await expect(expired.json()).resolves.toMatchObject({
      code: "RUN_EXPIRED",
    });

    const provider = twoStageFetch(
      directPlan,
      directExperience("cursor-ahead-interface"),
    );
    vi.stubGlobal("fetch", provider);
    const runId = "run-cursor-1234";
    const firstResponse = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Create a cursor test", runId }),
      }),
    );
    const firstFrames = await frames(firstResponse);
    const ahead = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Create a cursor test",
          runId,
          afterSequence: firstFrames.at(-1)!.sequence + 1,
        }),
      }),
    );

    expect(ahead.status).toBe(416);
    await expect(ahead.json()).resolves.toMatchObject({
      code: "RUN_CURSOR_AHEAD",
    });
  });

  it("rejects new work when every bounded run slot is active", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    for (let index = 0; index < 32; index += 1)
      universalRunStore.open(
        `run-capacity-${String(index).padStart(4, "0")}`,
        `fingerprint-${index}`,
      );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Start one run beyond the bounded capacity",
          runId: "run-capacity-overflow",
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "RUN_CAPACITY_REACHED",
    });
  });

  it("redesigns an existing surface without opening another one", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const experience = {
      ...directExperience("follow-up-test"),
      suggestions: ["Show costs", "Create a checklist"],
    };
    vi.stubGlobal("fetch", twoStageFetch(directPlan, experience));
    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Adapt the current response",
          currentExperience: uiLanguageFixture,
          currentSurfaceId: "response-welcome",
        }),
      }),
    );
    const streamed = await frames(response);
    expect(
      streamed.some(
        (frame) => frame.type === "a2ui" && "createSurface" in frame.message,
      ),
    ).toBe(false);
    expect(
      streamed
        .filter(
          (frame) =>
            frame.type === "a2ui" && "updateComponents" in frame.message,
        )
        .every(
          (frame) =>
            frame.type === "a2ui" &&
            "updateComponents" in frame.message &&
            frame.message.updateComponents.surfaceId === "response-welcome",
        ),
    ).toBe(true);
  });

  it("treats prior UI as compact context instead of the next answer", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const userInputs: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          stream?: boolean;
          input?: Array<{ content?: string }>;
        };
        userInputs.push(payload.input?.[1]?.content ?? "");
        return payload.stream
          ? modelResponse(directExperience("career-timeline"))
          : plannerResponse(decisionFor(directPlan));
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Show his NBA career timeline",
          currentExperience: uiLanguageFixture,
          conversation: ["Who is LeBron James?", "Show his recent stats"],
        }),
      }),
    );
    const streamed = await frames(response);

    expect(streamed.at(-1)).toMatchObject({
      type: "complete",
      experience: { responseId: "career-timeline" },
    });
    expect(
      userInputs.every((input) => input.startsWith("CURRENT USER REQUEST")),
    ).toBe(true);
    expect(userInputs[0]).toContain("Show his NBA career timeline");
    expect(userInputs[0]).toContain(
      "Create a new assistant response for this conversation turn.",
    );
    expect(userInputs[0]).toContain("Prior answer context:");
    expect(userInputs[0]).not.toContain("Current validated UI graph");
    expect(userInputs[0]).not.toContain('"nodes"');
  });

  it("resolves model-authored image intent into attributed trusted media", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const profilePlan = {
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["profile-reference"],
      confidence: 0.98,
      userJob: "identify Steve Jobs",
      informationShapes: ["media-artifact", "facts"],
      interactionLevel: "read",
      scale: "compact",
      topology: "focal-split",
      noveltyBudget: 0.25,
      slots: [
        {
          id: "identity",
          role: "identity",
          shape: "media-artifact",
          priority: "primary",
          required: true,
        },
        {
          id: "facts",
          role: "defining-facts",
          shape: "facts",
          priority: "supporting",
          required: true,
        },
      ],
    };
    const mediaExperience = {
      version: "4.0",
      responseId: "steve-jobs-test",
      goal: "Identify Steve Jobs",
      suggestions: [],
      screen: { title: "Steve Jobs", contextLabel: "Profile" },
      nodes: [
        {
          id: "root",
          type: "Page",
          slot: "",
          importance: "supporting",
          relationship: "standalone",
          mediaRole: "none",
          align: "start",
          columns: 1,
          gap: "normal",
          children: ["profile"],
        },
        {
          id: "profile",
          type: "Grid",
          slot: "",
          importance: "supporting",
          relationship: "grouped",
          mediaRole: "none",
          align: "start",
          columns: 2,
          gap: "normal",
          children: ["steve-image", "facts"],
        },
        {
          id: "steve-image",
          type: "Image",
          slot: "identity",
          importance: "primary",
          relationship: "grouped",
          mediaRole: "identity",
          title: "Steve Jobs",
          label: "Steve Jobs",
          text: "Apple co-founder and product leader.",
        },
        {
          id: "facts",
          type: "FactList",
          slot: "facts",
          importance: "supporting",
          relationship: "grouped",
          mediaRole: "none",
          title: "Steve Jobs",
          text: "",
          label: "Profile",
          value: "",
          meta: "",
          items: [
            {
              id: "founder",
              label: "Apple co-founder",
              value: "1976",
              detail: "Co-founded Apple with Steve Wozniak and Ronald Wayne.",
              progress: null,
            },
            {
              id: "leader",
              label: "Product leader",
              value: "",
              detail: "Helped shape the personal computing and mobile eras.",
              progress: null,
            },
          ],
        },
      ],
    };
    let openAICalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("api.openai.com")) {
          openAICalls += 1;
          return openAICalls === 1
            ? plannerResponse(
                decisionFor(profilePlan, {
                  attentionMode: "read",
                  primarySubject: "Steve Jobs",
                  obligations: [
                    {
                      id: "identity",
                      slotId: "identity",
                      purpose: "Identify Steve Jobs visually and succinctly.",
                      shape: "media-artifact",
                      priority: "primary",
                      mediaQuery: "Steve Jobs",
                      itemCount: 18,
                    },
                    {
                      id: "defining-facts",
                      slotId: "facts",
                      purpose:
                        "Communicate the few facts that explain his significance.",
                      shape: "facts",
                      priority: "supporting",
                      mediaQuery: "",
                    },
                  ],
                }),
              )
            : modelResponse(mediaExperience);
        }
        if (url.includes("en.wikipedia.org"))
          return new Response(
            JSON.stringify({
              query: {
                pages: [
                  {
                    title: "Steve Jobs",
                    fullurl: "https://en.wikipedia.org/wiki/Steve_Jobs",
                    pageimage: "Steve_Jobs.jpg",
                    thumbnail: {
                      source: "https://upload.wikimedia.org/steve.jpg",
                      width: 900,
                      height: 1200,
                    },
                  },
                ],
              },
            }),
            { status: 200 },
          );
        if (url.includes("upload.wikimedia.org"))
          return new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "content-type": "image/jpeg" },
          });
        return new Response(
          JSON.stringify({
            query: {
              pages: [
                {
                  imageinfo: [
                    {
                      thumburl: "https://upload.wikimedia.org/steve-thumb.jpg",
                      thumbwidth: 900,
                      thumbheight: 1200,
                      descriptionurl:
                        "https://commons.wikimedia.org/wiki/File:Steve_Jobs.jpg",
                      extmetadata: {
                        Artist: { value: "Matthew Yohe" },
                        LicenseShortName: { value: "CC BY-SA 3.0" },
                      },
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        );
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Who is Steve Jobs? Include a useful visual.",
        }),
      }),
    );
    const streamed = await frames(response);
    expect(
      streamed.some(
        (frame) => frame.type === "status" && frame.phase === "media",
      ),
    ).toBe(true);
    const complete = streamed.find((frame) => frame.type === "complete");
    expect(
      complete?.type === "complete"
        ? complete.experience.nodes.find((node) => node.type === "Image")
        : null,
    ).toMatchObject({
      type: "Image",
      meta: "Wikimedia",
      items: [{ label: "Matthew Yohe", value: "CC BY-SA 3.0" }],
    });
    if (complete?.type === "complete")
      expect(
        complete.experience.nodes.find((node) => node.type === "Image")?.value,
      ).toContain("/api/media/image?src=");
  });

  it("repairs an invalid UX decision once before composing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    let directionCalls = 0;
    let compositionCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          stream?: boolean;
          input?: Array<{ content?: string }>;
        };
        if (payload.stream) {
          compositionCalls += 1;
          return modelResponse(directExperience("repaired-direction"));
        }
        directionCalls += 1;
        return plannerResponse(
          directionCalls === 1 ? {} : decisionFor(directPlan),
        );
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Explain semantic recovery for this unique test",
        }),
      }),
    );
    const streamed = await frames(response);
    const complete = streamed.find((frame) => frame.type === "complete");

    expect(directionCalls).toBe(2);
    expect(compositionCalls).toBe(1);
    expect(
      streamed.some(
        (frame) => frame.type === "status" && frame.phase === "repairing",
      ),
    ).toBe(true);
    expect(streamed.some((frame) => frame.type === "error")).toBe(false);
    expect(complete).toMatchObject({
      type: "complete",
      experience: { responseId: "repaired-direction" },
      meta: {
        inputTokens: 200,
        outputTokens: 360,
        recovery: {
          directionAttempts: 2,
          compositionAttempts: 1,
          semanticRepairs: 1,
          fallbackUsed: false,
          repairInputTokens: 40,
          repairOutputTokens: 60,
        },
      },
    });
  });

  it("discards a provisional invalid graph and regenerates a valid graph once", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    let directionCalls = 0;
    let compositionCalls = 0;
    const compositionInstructions: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          stream?: boolean;
          input?: Array<{ content?: string }>;
        };
        if (!payload.stream) {
          directionCalls += 1;
          return plannerResponse(decisionFor(directPlan));
        }
        compositionCalls += 1;
        compositionInstructions.push(payload.input?.[0]?.content ?? "");
        return modelResponse(
          compositionCalls === 1
            ? invalidExperience("invalid-first-pass")
            : directExperience("repaired-graph"),
        );
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Explain graph recovery for this unique test",
        }),
      }),
    );
    const streamed = await frames(response);
    const complete = streamed.find((frame) => frame.type === "complete");
    const generationAttempts = streamed.flatMap((frame) =>
      frame.type === "a2ui" &&
      "updateDataModel" in frame.message &&
      frame.message.updateDataModel.path === "/generationAttempt"
        ? [frame.message.updateDataModel.value]
        : [],
    );

    expect(directionCalls).toBe(1);
    expect(compositionCalls).toBe(2);
    expect(compositionInstructions[0]).not.toContain(
      "Trusted validator feedback",
    );
    expect(compositionInstructions[1]).toContain("Trusted validator feedback");
    expect(compositionInstructions[1]).toContain("Too small");
    expect(generationAttempts).toEqual([
      { attempt: 1, state: "composing" },
      { attempt: 2, state: "repairing" },
      { attempt: 2, state: "composing" },
    ]);
    expect(streamed.some((frame) => frame.type === "error")).toBe(false);
    expect(complete).toMatchObject({
      type: "complete",
      experience: { responseId: "repaired-graph" },
      meta: {
        inputTokens: 280,
        outputTokens: 540,
        recovery: {
          directionAttempts: 1,
          compositionAttempts: 2,
          semanticRepairs: 1,
          fallbackUsed: false,
          repairInputTokens: 120,
          repairOutputTokens: 240,
        },
      },
    });
  });

  it("keeps the last validated UI when a follow-up cannot be repaired", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    let compositionCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          stream?: boolean;
        };
        if (!payload.stream) return plannerResponse(decisionFor(directPlan));
        compositionCalls += 1;
        return modelResponse(
          invalidExperience(`invalid-follow-up-${compositionCalls}`),
        );
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Redesign this response but preserve it if generation fails",
          currentExperience: uiLanguageFixture,
          currentSurfaceId: "response-welcome",
        }),
      }),
    );
    const streamed = await frames(response);
    const complete = streamed.find((frame) => frame.type === "complete");

    expect(compositionCalls).toBe(2);
    expect(streamed.some((frame) => frame.type === "error")).toBe(false);
    expect(complete).toMatchObject({
      type: "complete",
      experience: { responseId: uiLanguageFixture.responseId },
      meta: {
        recovery: {
          directionAttempts: 1,
          compositionAttempts: 2,
          semanticRepairs: 1,
          fallbackUsed: true,
        },
      },
    });
  });

  it("never presents stale UI as a successful new conversation turn", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    let compositionCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          stream?: boolean;
        };
        if (!payload.stream) return plannerResponse(decisionFor(directPlan));
        compositionCalls += 1;
        return modelResponse(
          invalidExperience(`invalid-conversation-${compositionCalls}`),
        );
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Show his NBA career timeline",
          currentExperience: uiLanguageFixture,
        }),
      }),
    );
    const streamed = await frames(response);

    expect(compositionCalls).toBe(2);
    expect(streamed.some((frame) => frame.type === "complete")).toBe(false);
    expect(streamed.at(-1)).toMatchObject({
      type: "error",
      code: "INVALID_OUTPUT",
    });
  });

  it("repairs a response that compresses an exact collection into too few entries", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const ideasPlan = {
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["explainer"],
      confidence: 0.95,
      userJob: "explain autumn leaf color in three concise ideas",
      informationShapes: ["narrative", "facts"],
      interactionLevel: "read",
      scale: "compact",
      topology: "editorial-stack",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "thesis",
          role: "thesis",
          shape: "narrative",
          priority: "primary",
          required: true,
        },
        {
          id: "ideas",
          role: "explanation",
          shape: "facts",
          priority: "supporting",
          required: true,
        },
      ],
    };
    const ideas = [
      {
        id: "chlorophyll",
        label: "Green fades",
        value: "",
        detail: "Chlorophyll production slows.",
        progress: null,
      },
      {
        id: "carotenoids",
        label: "Warm colors remain",
        value: "",
        detail: "Yellow and orange pigments become visible.",
        progress: null,
      },
      {
        id: "anthocyanins",
        label: "Red can appear",
        value: "",
        detail: "Some leaves produce red pigments from trapped sugars.",
        progress: null,
      },
    ];
    const ideasExperience = (count: number, responseId: string) => ({
      version: "4.0",
      responseId,
      goal: "Explain autumn color",
      suggestions: [],
      screen: { title: "Why leaves change color", contextLabel: "Explainer" },
      nodes: [
        {
          id: "root",
          type: "Page",
          slot: "",
          importance: "supporting",
          relationship: "standalone",
          mediaRole: "none",
          align: "start",
          columns: 1,
          gap: "normal",
          children: ["thesis", "ideas"],
        },
        {
          id: "thesis",
          type: "Text",
          slot: "thesis",
          importance: "primary",
          relationship: "standalone",
          mediaRole: "none",
          title: "Autumn changes the pigment balance",
          text: "Shorter days and cooler temperatures trigger the transition.",
          label: "",
          value: "",
          meta: "",
        },
        {
          id: "ideas",
          type: "FactList",
          slot: "ideas",
          importance: "supporting",
          relationship: "continuation",
          mediaRole: "none",
          title: "Three mechanisms",
          text: "",
          label: "",
          value: "",
          meta: "",
          items: ideas.slice(0, count),
        },
      ],
    });
    let compositionCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body ?? "{}")) as {
          stream?: boolean;
        };
        if (!payload.stream)
          return plannerResponse(
            decisionFor(ideasPlan, {
              attentionMode: "read",
              obligations: [
                {
                  id: "thesis",
                  slotId: "thesis",
                  purpose: "State the cause.",
                  shape: "narrative",
                  priority: "primary",
                  mediaQuery: "",
                  itemCount: null,
                },
                {
                  id: "ideas",
                  slotId: "ideas",
                  purpose: "Explain the three mechanisms.",
                  shape: "facts",
                  priority: "supporting",
                  mediaQuery: "",
                  itemCount: 3,
                },
              ],
            }),
          );
        compositionCalls += 1;
        return modelResponse(
          compositionCalls === 1
            ? ideasExperience(2, "too-short")
            : ideasExperience(3, "exact-count"),
        );
      }),
    );

    const response = await POST(
      new NextRequest("http://localhost/api/ui", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt:
            "Explain why leaves change color in autumn in three concise ideas",
        }),
      }),
    );
    const streamed = await frames(response);
    const complete = streamed.find((frame) => frame.type === "complete");

    expect(compositionCalls).toBe(2);
    expect(streamed.some((frame) => frame.type === "error")).toBe(false);
    expect(complete).toMatchObject({
      type: "complete",
      experience: { responseId: "exact-count" },
      meta: {
        recovery: {
          compositionAttempts: 2,
          semanticRepairs: 1,
          fallbackUsed: false,
        },
      },
    });
    expect(
      complete?.type === "complete"
        ? complete.experience.nodes
            .find((node) => node.id === "ideas")
            ?.items.map((item) => item.id)
        : [],
    ).toEqual(ideas.map((item) => item.id));
  });
});
