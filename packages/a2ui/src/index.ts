import { z } from "zod";

export interface A2UIComponent {
  id: string;
  component: string;
  catalogId?: string;
  [property: string]: unknown;
}

export type A2UIMessage =
  | {
    version: "v1.0";
    createSurface: {
      surfaceId: string;
      catalogId?: string;
      sendDataModel?: boolean;
      components?: A2UIComponent[];
      dataModel?: Record<string, unknown>;
    };
  }
  | {
    version: "v1.0";
    updateComponents: { surfaceId: string; components: A2UIComponent[] };
  }
  | {
    version: "v1.0";
    updateDataModel: { surfaceId: string; path?: string; value: unknown };
  }
  | {
    version: "v1.0";
    deleteSurface: { surfaceId: string };
  };

export interface A2UISurfaceState {
  surfaceId: string;
  catalogId?: string;
  sendDataModel: boolean;
  components: Record<string, A2UIComponent>;
  dataModel: Record<string, unknown>;
}

export const a2uiComponentSchema = z.object({
  id: z.string().min(1),
  component: z.string().min(1),
  catalogId: z.string().min(1).optional(),
}).passthrough();

const createSurfaceSchema = z.object({
  surfaceId: z.string().min(1),
  catalogId: z.string().min(1).optional(),
  sendDataModel: z.boolean().optional(),
  components: z.array(a2uiComponentSchema).optional(),
  dataModel: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const a2uiMessageSchema = z.union([
  z.object({ version: z.literal("v1.0"), createSurface: createSurfaceSchema }).strict(),
  z.object({
    version: z.literal("v1.0"),
    updateComponents: z.object({
      surfaceId: z.string().min(1),
      components: z.array(a2uiComponentSchema),
    }).strict(),
  }).strict(),
  z.object({
    version: z.literal("v1.0"),
    updateDataModel: z.object({
      surfaceId: z.string().min(1),
      path: z.string().optional(),
      value: z.unknown(),
    }).strict(),
  }).strict(),
  z.object({
    version: z.literal("v1.0"),
    deleteSurface: z.object({ surfaceId: z.string().min(1) }).strict(),
  }).strict(),
]);

export const a2uiSurfaceStateSchema = z.object({
  surfaceId: z.string().min(1),
  catalogId: z.string().min(1).optional(),
  sendDataModel: z.boolean(),
  components: z.record(z.string(), a2uiComponentSchema),
  dataModel: z.record(z.string(), z.unknown()),
}).strict();

export function parseA2UIMessage(input: unknown): A2UIMessage {
  return a2uiMessageSchema.parse(input) as A2UIMessage;
}

export function parseA2UISurfaceState(input: unknown): A2UISurfaceState {
  return a2uiSurfaceStateSchema.parse(input) as A2UISurfaceState;
}

/** Decode newline-delimited JSON from an HTTP response without assuming chunk boundaries. */
export async function* decodeJsonLines<T = unknown>(
  stream: ReadableStream<Uint8Array>,
  parse: (value: unknown) => T = (value) => value as T,
): AsyncGenerator<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      yield parse(JSON.parse(line) as unknown);
    }
    if (done) break;
  }
  if (buffer.trim()) yield parse(JSON.parse(buffer) as unknown);
}

function assertComponentList(components: readonly A2UIComponent[]) {
  const ids = new Set<string>();
  for (const component of components) {
    if (ids.has(component.id)) throw new Error(`A2UI component ID '${component.id}' is duplicated.`);
    ids.add(component.id);
  }
}

function updateAtJsonPointer(model: Record<string, unknown>, path: string | undefined, value: unknown) {
  if (!path || path === "/") return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
  if (!path.startsWith("/")) throw new Error(`A2UI data model path '${path}' is not a JSON Pointer.`);
  const segments = path.split("/").slice(1).map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  const root = structuredClone(model);
  let cursor: Record<string, unknown> = root;
  for (const segment of segments.slice(0, -1)) {
    const existing = cursor[segment];
    cursor[segment] = existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
    cursor = cursor[segment] as Record<string, unknown>;
  }
  const finalSegment = segments.at(-1);
  if (!finalSegment) return root;
  if (value === null) delete cursor[finalSegment];
  else cursor[finalSegment] = value;
  return root;
}

export function reduceA2UIMessage(state: A2UISurfaceState | null, message: A2UIMessage): A2UISurfaceState | null {
  const parsedMessage = parseA2UIMessage(message);
  if ("createSurface" in parsedMessage) {
    const created = parsedMessage.createSurface;
    assertComponentList(created.components ?? []);
    return {
      surfaceId: created.surfaceId,
      ...(created.catalogId ? { catalogId: created.catalogId } : {}),
      sendDataModel: created.sendDataModel ?? false,
      components: Object.fromEntries((created.components ?? []).map((component) => [component.id, component])),
      dataModel: { ...(created.dataModel ?? {}) },
    };
  }
  if (!state) throw new Error("A2UI surface must be created before it can be updated.");
  if ("deleteSurface" in parsedMessage) {
    if (parsedMessage.deleteSurface.surfaceId !== state.surfaceId) return state;
    return null;
  }
  const update = "updateComponents" in parsedMessage ? parsedMessage.updateComponents : parsedMessage.updateDataModel;
  if (update.surfaceId !== state.surfaceId) throw new Error(`A2UI message targets unknown surface '${update.surfaceId}'.`);
  if ("updateComponents" in parsedMessage) {
    assertComponentList(parsedMessage.updateComponents.components);
    return {
      ...state,
      components: {
        ...state.components,
        ...Object.fromEntries(parsedMessage.updateComponents.components.map((component) => [component.id, component])),
      },
    };
  }
  return {
    ...state,
    dataModel: updateAtJsonPointer(state.dataModel, parsedMessage.updateDataModel.path, parsedMessage.updateDataModel.value),
  };
}

export function reduceA2UIStream(messages: readonly A2UIMessage[]): A2UISurfaceState | null {
  return reduceA2UIMessages(null, messages);
}

export function reduceA2UIMessages(
  initialState: A2UISurfaceState | null,
  messages: readonly A2UIMessage[],
): A2UISurfaceState | null {
  return messages.reduce<A2UISurfaceState | null>((state, message) => reduceA2UIMessage(state, message), initialState);
}
