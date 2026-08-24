import { parseA2UISurfaceState, type A2UISurfaceState } from "@fify/a2ui";
import { uiExperienceSchema, type UIExperience } from "@fify/core";
import {
  parseUniversalGenerationActivity,
  parseUniversalGenerationStatus,
  type UniversalGenerationActivity,
  type UniversalGenerationMeta,
  type UniversalGenerationStatus,
} from "./universal-generation-stream";

export const universalConversationStorageKey =
  "fify.universal-conversations.v2";
export const legacyUniversalConversationStorageKey =
  "fify.universal-conversation.v1";
export const universalSessionKeyStorageKey = "fify.universal-api-key.v1";

export interface UniversalRunRequest {
  prompt: string;
  currentExperience?: UIExperience;
  conversation: string[];
}

export interface DurableConversationTurn {
  id: string;
  runId: string;
  lastSequence: number;
  prompt: string | null;
  request: UniversalRunRequest | null;
  surface: A2UISurfaceState | null;
  experience: UIExperience | null;
  phase: string;
  progress: UniversalGenerationStatus | null;
  activities: readonly UniversalGenerationActivity[];
  startedAt: number;
  lastActivityAt: number;
  meta: UniversalGenerationMeta | null;
  error: string | null;
  checked: readonly string[];
  selected: Readonly<Record<string, string>>;
  inputs: Readonly<Record<string, string>>;
}

export interface DurableConversationThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: DurableConversationTurn[];
}

export interface DurableConversationState {
  activeConversationId: string | null;
  conversations: DurableConversationThread[];
}

export const emptyDurableConversationState: DurableConversationState = {
  activeConversationId: null,
  conversations: [],
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringRecord(value: unknown) {
  const record = object(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function parseRequest(value: unknown): UniversalRunRequest | null {
  const record = object(value);
  if (!record || typeof record.prompt !== "string") return null;
  const current = record.currentExperience
    ? uiExperienceSchema.safeParse(record.currentExperience)
    : null;
  return {
    prompt: record.prompt,
    ...(current?.success ? { currentExperience: current.data } : {}),
    conversation: Array.isArray(record.conversation)
      ? record.conversation.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

function parseTurn(value: unknown): DurableConversationTurn | null {
  const record = object(value);
  if (
    !record ||
    typeof record.id !== "string" ||
    typeof record.runId !== "string" ||
    record.runId.length < 8 ||
    !Number.isInteger(record.lastSequence) ||
    typeof record.phase !== "string"
  )
    return null;
  const surface = record.surface
    ? (() => {
        try {
          return parseA2UISurfaceState(record.surface);
        } catch {
          return null;
        }
      })()
    : null;
  const experience = record.experience
    ? uiExperienceSchema.safeParse(record.experience)
    : null;
  const progress = record.progress
    ? (() => {
        try {
          return parseUniversalGenerationStatus(record.progress);
        } catch {
          return null;
        }
      })()
    : null;
  const activities = Array.isArray(record.activities)
    ? record.activities.flatMap((activity) => {
        try {
          return [parseUniversalGenerationActivity(activity)];
        } catch {
          return [];
        }
      })
    : [];
  const restoredAt = Date.now();
  const startedAt =
    typeof record.startedAt === "number" &&
    Number.isFinite(record.startedAt) &&
    record.startedAt > 0
      ? record.startedAt
      : Math.max(1, restoredAt - (progress?.elapsedMs ?? 0));
  const lastActivityAt =
    typeof record.lastActivityAt === "number" &&
    Number.isFinite(record.lastActivityAt) &&
    record.lastActivityAt >= startedAt
      ? record.lastActivityAt
      : startedAt + (progress?.elapsedMs ?? 0);
  return {
    id: record.id,
    runId: record.runId,
    lastSequence: Number(record.lastSequence),
    prompt: typeof record.prompt === "string" ? record.prompt : null,
    request: parseRequest(record.request),
    surface,
    experience: experience?.success ? experience.data : null,
    phase: record.phase,
    progress,
    activities: activities.slice(-12),
    startedAt,
    lastActivityAt,
    meta: object(record.meta)
      ? (record.meta as unknown as UniversalGenerationMeta)
      : null,
    error: typeof record.error === "string" ? record.error : null,
    checked: Array.isArray(record.checked)
      ? record.checked.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    selected: stringRecord(record.selected),
    inputs: stringRecord(record.inputs),
  };
}

export function parseDurableConversation(value: unknown) {
  const record = object(value);
  if (record?.version !== 1 || !Array.isArray(record.turns)) return [];
  return record.turns.flatMap((turn) => {
    const parsed = parseTurn(turn);
    return parsed ? [parsed] : [];
  });
}

export function serializeDurableConversation(
  turns: readonly DurableConversationTurn[],
) {
  return JSON.stringify({ version: 1, turns: turns.slice(-20) });
}

function conversationTitle(turns: readonly DurableConversationTurn[]) {
  const prompt = turns.find((turn) => turn.prompt)?.prompt?.trim();
  if (!prompt) return "New conversation";
  return prompt.length > 56 ? `${prompt.slice(0, 55).trimEnd()}…` : prompt;
}

function parseThread(value: unknown): DurableConversationThread | null {
  const record = object(value);
  if (
    !record ||
    typeof record.id !== "string" ||
    record.id.length < 8 ||
    typeof record.title !== "string" ||
    !Array.isArray(record.turns)
  )
    return null;
  const turns = record.turns.flatMap((turn) => {
    const parsed = parseTurn(turn);
    return parsed ? [parsed] : [];
  });
  const now = Date.now();
  const createdAt =
    typeof record.createdAt === "number" &&
    Number.isFinite(record.createdAt) &&
    record.createdAt > 0
      ? record.createdAt
      : (turns[0]?.startedAt ?? now);
  const updatedAt =
    typeof record.updatedAt === "number" &&
    Number.isFinite(record.updatedAt) &&
    record.updatedAt >= createdAt
      ? record.updatedAt
      : (turns.at(-1)?.lastActivityAt ?? createdAt);
  return {
    id: record.id,
    title: record.title.trim() || conversationTitle(turns),
    createdAt,
    updatedAt,
    turns: turns.slice(-20),
  };
}

/** Parses v2 multi-thread state and migrates the former single-thread format. */
export function parseDurableConversationState(
  value: unknown,
): DurableConversationState {
  const record = object(value);
  if (record?.version === 2 && Array.isArray(record.conversations)) {
    const conversations = record.conversations.flatMap((conversation) => {
      const parsed = parseThread(conversation);
      return parsed ? [parsed] : [];
    });
    const requestedActiveId =
      typeof record.activeConversationId === "string"
        ? record.activeConversationId
        : null;
    return {
      activeConversationId: conversations.some(
        (conversation) => conversation.id === requestedActiveId,
      )
        ? requestedActiveId
        : (conversations.at(-1)?.id ?? null),
      conversations: conversations.slice(-12),
    };
  }

  const legacyTurns = parseDurableConversation(value);
  if (!legacyTurns.length) return emptyDurableConversationState;
  const createdAt = legacyTurns[0]?.startedAt ?? Date.now();
  const conversation: DurableConversationThread = {
    id: "conversation-migrated-v1",
    title: conversationTitle(legacyTurns),
    createdAt,
    updatedAt: legacyTurns.at(-1)?.lastActivityAt ?? createdAt,
    turns: legacyTurns,
  };
  return {
    activeConversationId: conversation.id,
    conversations: [conversation],
  };
}

export function serializeDurableConversationState(
  state: DurableConversationState,
) {
  const conversations = state.conversations.slice(-12).map((conversation) => ({
    ...conversation,
    turns: conversation.turns.slice(-20),
  }));
  return JSON.stringify({
    version: 2,
    activeConversationId: conversations.some(
      (conversation) => conversation.id === state.activeConversationId,
    )
      ? state.activeConversationId
      : (conversations.at(-1)?.id ?? null),
    conversations,
  });
}
