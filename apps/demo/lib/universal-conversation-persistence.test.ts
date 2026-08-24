import { describe, expect, it } from "vitest";
import { reduceA2UIStream } from "@fify/a2ui";
import { uiExperienceToA2UI, uiLanguageFixture } from "@fify/core";
import {
  parseDurableConversation,
  parseDurableConversationState,
  serializeDurableConversation,
  serializeDurableConversationState,
  type DurableConversationState,
  type DurableConversationTurn,
} from "./universal-conversation-persistence";

describe("universal conversation persistence", () => {
  it("round-trips validated UI, state, and a resumable run cursor", () => {
    const surface = reduceA2UIStream(uiExperienceToA2UI(uiLanguageFixture));
    const turn: DurableConversationTurn = {
      id: "turn-1",
      runId: "run-12345678",
      lastSequence: 7,
      prompt: "Show me a useful interface",
      request: {
        prompt: "Show me a useful interface",
        conversation: [],
      },
      surface,
      experience: uiLanguageFixture,
      phase: "Interface ready",
      progress: {
        type: "status",
        phase: "rendering",
        elapsedMs: 820,
        state: "completed",
        completedUnits: 2,
        totalUnits: 2,
        unit: "regions",
      },
      activities: [
        {
          type: "activity",
          id: "compose",
          phase: "composing",
          label: "Building the interface",
          detail: "Drafting the planned response regions.",
          state: "complete",
          source: "pipeline",
          elapsedMs: 720,
        },
      ],
      startedAt: 1_700_000_000_000,
      lastActivityAt: 1_700_000_000_820,
      meta: null,
      error: null,
      checked: ["task-1"],
      selected: { choice: "a" },
      inputs: { budget: "4200" },
    };
    expect(
      parseDurableConversation(
        JSON.parse(serializeDurableConversation([turn])) as unknown,
      ),
    ).toEqual([turn]);

    const state: DurableConversationState = {
      activeConversationId: "conversation-second",
      conversations: [
        {
          id: "conversation-first",
          title: "First thread",
          createdAt: turn.startedAt,
          updatedAt: turn.lastActivityAt,
          turns: [turn],
        },
        {
          id: "conversation-second",
          title: "Second thread",
          createdAt: turn.startedAt + 1_000,
          updatedAt: turn.lastActivityAt + 1_000,
          turns: [{ ...turn, id: "turn-2", runId: "run-87654321" }],
        },
      ],
    };
    expect(
      parseDurableConversationState(
        JSON.parse(serializeDurableConversationState(state)) as unknown,
      ),
    ).toEqual(state);
  });

  it("drops malformed turns instead of restoring untrusted state", () => {
    expect(
      parseDurableConversation({
        version: 1,
        turns: [{ id: "bad", runId: "short" }],
      }),
    ).toEqual([]);
  });

  it("migrates the former single-thread store without losing its turns", () => {
    const legacy = {
      version: 1,
      turns: [
        {
          id: "turn-legacy",
          runId: "run-legacy-1234",
          lastSequence: 0,
          prompt: "Plan a focused trip",
          request: null,
          surface: null,
          experience: null,
          phase: "Interface ready",
          progress: null,
          activities: [],
          startedAt: 1_700_000_000_000,
          lastActivityAt: 1_700_000_000_100,
          meta: null,
          error: null,
          checked: [],
          selected: {},
          inputs: {},
        },
      ],
    };
    const migrated = parseDurableConversationState(legacy);
    expect(migrated.conversations).toHaveLength(1);
    expect(migrated.conversations[0]).toMatchObject({
      title: "Plan a focused trip",
      turns: [expect.objectContaining({ id: "turn-legacy" })],
    });
    expect(migrated.activeConversationId).toBe(migrated.conversations[0]?.id);
  });
});
