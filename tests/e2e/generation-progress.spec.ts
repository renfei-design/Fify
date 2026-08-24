import { expect, test } from "@playwright/test";
import { uiLanguageFixture } from "@fify/core";

test("generation activity streams beside UI output and collapses when ready", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.addInitScript((experience) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (!url.endsWith("/api/ui")) return originalFetch(input, init);
      if (!init?.method || init.method === "GET")
        return new Response(
          JSON.stringify({ provider: "openai", configured: true }),
          { headers: { "content-type": "application/json" } },
        );

      const request = JSON.parse(String(init.body ?? "{}")) as {
        runId: string;
      };
      const surfaceId = "activity-test-surface";
      const catalogId = "https://fify.dev/catalogs/ui-language/4.0";
      const component = (node: (typeof experience.nodes)[number]) => ({
        ...node,
        component: node.type,
        catalogId,
      });
      const opening = experience.nodes.find((node) => node.id === "opening")!;
      const root = {
        ...experience.nodes.find((node) => node.id === "root")!,
        children: [opening.id],
      };
      const payloads = [
        {
          at: 0,
          value: {
            type: "status",
            phase: "accepted",
            elapsedMs: 0,
            state: "started",
          },
        },
        {
          at: 20,
          value: {
            type: "a2ui",
            message: {
              version: "v1.0",
              createSurface: {
                surfaceId,
                catalogId,
                sendDataModel: false,
                components: [],
                dataModel: {},
              },
            },
          },
        },
        {
          at: 350,
          value: {
            type: "status",
            phase: "routing",
            elapsedMs: 350,
            state: "started",
          },
        },
        {
          at: 1_000,
          value: {
            type: "status",
            phase: "composing",
            elapsedMs: 1_000,
            state: "started",
            completedUnits: 0,
            totalUnits: 1,
            unit: "regions",
            attempt: 1,
          },
        },
        {
          at: 1_300,
          value: {
            type: "activity",
            id: "composition-reasoning-1",
            phase: "composing",
            label: "Thinking through the interface",
            detail:
              "A focused visual hierarchy will keep the answer easy to scan.",
            state: "active",
            source: "provider",
            elapsedMs: 1_300,
          },
        },
        {
          at: 2_600,
          value: {
            type: "activity",
            id: "composition-reasoning-1",
            phase: "composing",
            label: "Thinking through the interface",
            detail:
              "A focused visual hierarchy will keep the answer easy to scan while preserving the primary explanation.",
            state: "active",
            source: "provider",
            elapsedMs: 2_600,
          },
        },
        {
          at: 3_200,
          value: {
            type: "a2ui",
            message: {
              version: "v1.0",
              updateDataModel: {
                surfaceId,
                path: "/screen",
                value: experience.screen,
              },
            },
          },
        },
        {
          at: 3_250,
          value: {
            type: "a2ui",
            message: {
              version: "v1.0",
              updateComponents: {
                surfaceId,
                components: [component(root), component(opening)],
              },
            },
          },
        },
        {
          at: 3_300,
          value: {
            type: "status",
            phase: "composing",
            elapsedMs: 3_300,
            state: "advanced",
            completedUnits: 1,
            totalUnits: 1,
            unit: "regions",
            activeSlotId: "primary",
            attempt: 1,
          },
        },
        {
          at: 4_500,
          value: {
            type: "status",
            phase: "validating",
            elapsedMs: 4_500,
            state: "started",
            completedUnits: 1,
            totalUnits: 1,
            unit: "regions",
          },
        },
        {
          at: 5_000,
          value: {
            type: "a2ui",
            message: {
              version: "v1.0",
              updateComponents: {
                surfaceId,
                components: experience.nodes.map(component),
              },
            },
          },
        },
        {
          at: 5_200,
          value: {
            type: "status",
            phase: "rendering",
            elapsedMs: 5_200,
            state: "completed",
            completedUnits: 1,
            totalUnits: 1,
            unit: "regions",
          },
        },
        {
          at: 5_400,
          value: {
            type: "complete",
            experience,
            meta: {
              provider: "openai",
              model: "fixture-model",
              responseId: experience.responseId,
              latencyMs: 5_400,
              inputTokens: 20,
              outputTokens: 40,
              cached: false,
              timings: {
                routingMs: 900,
                compositionMs: 3_400,
                validationMs: 700,
              },
              decision: {
                attentionMode: "read",
                disclosureStrategy: "inline",
                visibleObligations: 1,
                deferredObligations: 0,
                maxVisibleNodes: experience.nodes.length,
              },
              policy: {
                visibleContentNodes: experience.nodes.length - 1,
                prunedContentNodes: 0,
                visibleCopyCharacters: 100,
                truncatedItemCount: 0,
              },
              recovery: {
                directionAttempts: 1,
                compositionAttempts: 1,
                semanticRepairs: 0,
                fallbackUsed: false,
                repairInputTokens: 0,
                repairOutputTokens: 0,
              },
            },
          },
        },
      ];
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          payloads.forEach(({ at, value }, index) => {
            window.setTimeout(() => {
              controller.enqueue(
                encoder.encode(
                  `${JSON.stringify({
                    ...value,
                    runId: request.runId,
                    sequence: index + 1,
                  })}\n`,
                ),
              );
              if (index === payloads.length - 1) controller.close();
            }, at);
          });
        },
      });
      return new Response(stream, {
        headers: { "content-type": "application/x-ndjson" },
      });
    };
  }, uiLanguageFixture);

  await page.goto("/");
  await page
    .getByLabel("Message Fify")
    .fill("Compare electric and hybrid cars for a city commute");
  await page.getByRole("button", { name: "Send message" }).click();

  const disclosure = page.locator(".gxchat-activity-toggle");
  await expect(disclosure).toBeVisible();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("progressbar")).toHaveCount(0);

  const activityTrace = page.locator(".gxchat-activity-trace");
  await expect(
    activityTrace.getByText("Thinking through the interface"),
  ).toBeVisible();
  await expect(
    page.getByText(
      /focused visual hierarchy will keep the answer easy to scan/,
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "The answer is an interface." }),
  ).toBeVisible();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");

  await expect(disclosure).toContainText("Interface ready");
  await expect(disclosure).not.toContainText("5.4s");
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByText(
      /focused visual hierarchy will keep the answer easy to scan/,
    ),
  ).toBeHidden();

  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText(
      /focused visual hierarchy will keep the answer easy to scan/,
    ),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
