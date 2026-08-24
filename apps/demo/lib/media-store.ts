interface StoredMedia {
  bytes: Uint8Array;
  mimeType: string;
  expiresAt: number;
}

const shared = globalThis as typeof globalThis & {
  __fifyGeneratedMedia?: Map<string, StoredMedia>;
};

const generatedMedia =
  shared.__fifyGeneratedMedia ?? new Map<string, StoredMedia>();
shared.__fifyGeneratedMedia = generatedMedia;

const ttlMs = 20 * 60_000;
const maxEntries = 24;

function prune() {
  const now = Date.now();
  for (const [id, media] of generatedMedia)
    if (media.expiresAt <= now) generatedMedia.delete(id);
  while (generatedMedia.size > maxEntries) {
    const oldest = generatedMedia.keys().next().value;
    if (typeof oldest !== "string") break;
    generatedMedia.delete(oldest);
  }
}

export function storeGeneratedMedia(bytes: Uint8Array, mimeType = "image/png") {
  prune();
  const id = crypto.randomUUID();
  generatedMedia.set(id, {
    bytes,
    mimeType,
    expiresAt: Date.now() + ttlMs,
  });
  return id;
}

export function readGeneratedMedia(id: string) {
  prune();
  const media = generatedMedia.get(id);
  if (!media) return null;
  generatedMedia.delete(id);
  generatedMedia.set(id, media);
  return media;
}
