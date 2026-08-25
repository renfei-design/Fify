import {
  informationEnvelopeV1Schema,
  isTrustedInformationImageUrl,
  type InformationEnvelopeV1,
} from "@fify/core";

const POSITIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1_000;
const DEFAULT_TIMEOUT_MS = 3_500;
const USER_AGENT =
  "Fify/0.1 (https://github.com/renfei-design/Fify; trusted profile media lookup)";

interface ResolvedProfilePortrait {
  imageUrl: string;
  sourceUrl: string;
  creator: string;
  license: string;
}

interface CacheEntry {
  expiresAt: number;
  value: ResolvedProfilePortrait | null;
}

export interface ProfileMediaLookupOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  cache?: boolean;
}

const portraitCache = new Map<string, CacheEntry>();

function plainText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function explicitNoImageRequest(request: string) {
  return /\b(?:without|omit|exclude|no|do not include|don't include)\s+(?:an?\s+)?(?:image|photo|portrait|picture)\b/i.test(
    request,
  );
}

function cleanProfileSubject(value: string) {
  const subject = value
    .replace(/[?.!]+$/g, "")
    .replace(
      /\s+(?:and\s+(?:why|how|what)|in\s+(?:detail|brief)|with\s+sources)\b.*$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  if (!subject || /[:/@]/.test(subject)) return null;
  const words = subject.split(/\s+/);
  return words.length >= 2 && words.length <= 6 ? subject : null;
}

/** Resolve only explicit real-person profile intent; never infer decorative media. */
export function profileSubjectForEnvelope(envelope: InformationEnvelopeV1) {
  if (explicitNoImageRequest(envelope.originalRequest)) return null;
  if (envelope.profileSubject?.trim())
    return cleanProfileSubject(envelope.profileSubject);
  const match = envelope.originalRequest.match(
    /(?:^|\b)(?:who\s+(?:is|was)|profile(?:\s+of)?|biography(?:\s+of)?|bio(?:\s+of)?|tell\s+me\s+about)\s+([^?!.]+)/i,
  );
  return match?.[1] ? cleanProfileSubject(match[1]) : null;
}

async function fetchJson(url: URL, fetchImpl: typeof fetch, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
    });
    if (!response.ok)
      throw new Error(`Profile media lookup returned HTTP ${response.status}.`);
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

function firstPage(payload: Record<string, unknown>) {
  const query = payload.query;
  if (!query || typeof query !== "object") return null;
  const pages = (query as { pages?: unknown }).pages;
  if (!pages || typeof pages !== "object") return null;
  return (
    Object.values(pages as Record<string, unknown>).find(
      (page): page is Record<string, unknown> =>
        Boolean(
          page &&
          typeof page === "object" &&
          !(page as { missing?: unknown }).missing,
        ),
    ) ?? null
  );
}

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return "";
  const entry = (metadata as Record<string, unknown>)[key];
  if (!entry || typeof entry !== "object") return "";
  return plainText((entry as { value?: unknown }).value);
}

async function resolveWikimediaPortrait(
  subject: string,
  options: ProfileMediaLookupOptions,
): Promise<ResolvedProfilePortrait | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pageUrl = new URL("https://en.wikipedia.org/w/api.php");
  pageUrl.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    redirects: "1",
    prop: "pageimages|info",
    inprop: "url",
    piprop: "thumbnail|name",
    pithumbsize: "1200",
    titles: subject,
  }).toString();
  const page = firstPage(await fetchJson(pageUrl, fetchImpl, timeoutMs));
  const filename = plainText(page?.pageimage);
  if (!filename) return null;

  const commonsUrl = new URL("https://commons.wikimedia.org/w/api.php");
  commonsUrl.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
    titles: filename.startsWith("File:") ? filename : `File:${filename}`,
  }).toString();
  const commonsPage = firstPage(
    await fetchJson(commonsUrl, fetchImpl, timeoutMs),
  );
  const imageInfo = Array.isArray(commonsPage?.imageinfo)
    ? commonsPage.imageinfo[0]
    : null;
  if (!imageInfo || typeof imageInfo !== "object") return null;
  const record = imageInfo as Record<string, unknown>;
  const imageUrl = plainText(record.thumburl || record.url);
  const sourceUrl = plainText(record.descriptionurl);
  if (
    !isTrustedInformationImageUrl(imageUrl) ||
    !sourceUrl.startsWith("https://commons.wikimedia.org/")
  )
    return null;
  return {
    imageUrl,
    sourceUrl,
    creator: metadataValue(record.extmetadata, "Artist"),
    license:
      metadataValue(record.extmetadata, "LicenseShortName") ||
      metadataValue(record.extmetadata, "UsageTerms"),
  };
}

function uniqueId(base: string, ids: Set<string>) {
  if (!ids.has(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`;
    if (!ids.has(candidate)) return candidate;
  }
  throw new Error(`Unable to allocate a unique semantic ID for '${base}'.`);
}

export async function enrichInformationEnvelopeWithProfileMedia(
  envelopeInput: InformationEnvelopeV1,
  options: ProfileMediaLookupOptions = {},
): Promise<InformationEnvelopeV1> {
  const envelope = informationEnvelopeV1Schema.parse(envelopeInput);
  if ((envelope.media ?? []).some((item) => item.role === "identity"))
    return envelope;
  const subject = profileSubjectForEnvelope(envelope);
  if (!subject || process.env.FIFY_PROFILE_MEDIA_LOOKUP === "0")
    return envelope;

  const cacheKey = subject.toLocaleLowerCase("en-US");
  const cached =
    options.cache === false ? undefined : portraitCache.get(cacheKey);
  let portrait =
    cached && cached.expiresAt > Date.now() ? cached.value : undefined;
  if (portrait === undefined) {
    try {
      portrait = await resolveWikimediaPortrait(subject, options);
    } catch {
      portrait = null;
    }
    if (options.cache !== false)
      portraitCache.set(cacheKey, {
        expiresAt:
          Date.now() +
          (portrait ? POSITIVE_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
        value: portrait,
      });
  }
  if (!portrait) return envelope;

  const ids = new Set([
    ...envelope.sources.map((source) => source.id),
    ...(envelope.media ?? []).map((media) => media.id),
    ...envelope.sections.flatMap((section) => [
      section.id,
      ...section.items.map((item) => item.id),
    ]),
  ]);
  const sourceId = uniqueId("profile-portrait-source", ids);
  ids.add(sourceId);
  const mediaId = uniqueId("profile-portrait", ids);
  const credit = [portrait.creator, portrait.license]
    .filter(Boolean)
    .join(" · ");
  return informationEnvelopeV1Schema.parse({
    ...envelope,
    profileSubject: subject,
    sources: [
      ...envelope.sources,
      {
        id: sourceId,
        title: credit
          ? `${subject} portrait — ${credit}`
          : `${subject} portrait source`,
        url: portrait.sourceUrl,
      },
    ],
    media: [
      ...(envelope.media ?? []),
      {
        id: mediaId,
        url: portrait.imageUrl,
        alt: `Portrait of ${subject}`,
        caption: credit || `Openly licensed portrait of ${subject}`,
        role: "identity",
        sourceId,
      },
    ],
  });
}
