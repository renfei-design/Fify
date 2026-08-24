import { uiExperienceSchema, uiNodeSchema, type UIExperience, type UINode } from "@fify/core";
import { storeGeneratedMedia } from "./media-store";

export interface ResolvedImage {
  url: string;
  sourceUrl: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  provider: "Wikimedia" | "Openverse" | "Generated";
  width: number;
  height: number;
}

interface ResolveImageOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  preferredAspect?: "portrait" | "landscape" | "square" | "natural";
  cache?: boolean;
}

interface EnrichExperienceOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  onResolved?: (node: UINode) => void | Promise<void>;
}

const imageCache = new Map<string, { expiresAt: number; value: ResolvedImage | null }>();
const positiveCacheTtlMs = 6 * 60 * 60_000;
const negativeCacheTtlMs = 5 * 60_000;
// Openverse search can occasionally take longer than a canonical Wikimedia lookup.
// Keep this below the route-level deadline while allowing the public index to answer.
const requestTimeoutMs = 10_000;

function clamp(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function plainText(value: unknown) {
  if (typeof value !== "string") return "";
  return clamp(value
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code))), 180);
}

function safeHttpsUrl(value: unknown, image = false) {
  if (typeof value !== "string" || value.length > 2_048) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    if (image && url.hostname !== "upload.wikimedia.org" && url.hostname !== "api.openverse.org") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function isAllowedRemoteImageUrl(value: unknown) {
  return Boolean(safeHttpsUrl(value, true));
}

function localImageUrl(remoteUrl: string) {
  return `/api/media/image?src=${encodeURIComponent(remoteUrl)}`;
}

function entityQuery(query: string) {
  return clamp(query
    .replace(/^(?:a |an |the )?(?:photo|photograph|portrait|headshot|image) of /i, "")
    .replace(/\s+(?:photo|photograph|portrait|headshot|image)$/i, ""), 80);
}

async function fetchJson(url: URL, options: ResolveImageOptions): Promise<Record<string, any>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException("Image lookup timed out", "AbortError")), requestTimeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "Fify/0.3 (open-source generative UI framework)" },
    });
    if (!response.ok) throw new Error(`Image provider returned ${response.status}.`);
    return await response.json() as Record<string, any>;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

async function probeImageUrl(value: string, options: ResolveImageOptions) {
  const url = safeHttpsUrl(value, true);
  if (!url) return false;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException("Image probe timed out", "AbortError")), 5_000);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
        range: "bytes=0-2047",
        "user-agent": "Fify/0.4 (open-source generative UI framework)",
      },
    });
    const healthy =
      response.ok &&
      isAllowedRemoteImageUrl(response.url || url) &&
      (response.headers.get("content-type") ?? "")
        .toLowerCase()
        .startsWith("image/");
    await response.body?.cancel().catch(() => undefined);
    return healthy;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

async function resolveWikimedia(query: string, options: ResolveImageOptions): Promise<ResolvedImage | null> {
  const canonical = entityQuery(query);
  if (!canonical) return null;
  const pageUrl = new URL("https://en.wikipedia.org/w/api.php");
  pageUrl.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "pageimages|info",
    inprop: "url",
    titles: canonical,
    piprop: "thumbnail|name|original",
    pithumbsize: "1400",
    pilicense: "free",
  }).toString();
  const payload = await fetchJson(pageUrl, options);
  const page = Array.isArray(payload.query?.pages) ? payload.query.pages[0] : null;
  const imageUrl = safeHttpsUrl(page?.thumbnail?.source, true);
  const sourceUrl = safeHttpsUrl(page?.fullurl);
  if (!page || page.missing || !imageUrl || !sourceUrl || typeof page.pageimage !== "string") return null;

  let creator = "Wikimedia contributor";
  let license = "See image source";
  let licenseUrl = "";
  let resolvedUrl = imageUrl;
  let resolvedSource = sourceUrl;
  let width = Number(page.thumbnail?.width ?? 0);
  let height = Number(page.thumbnail?.height ?? 0);
  try {
    const commonsUrl = new URL("https://commons.wikimedia.org/w/api.php");
    commonsUrl.search = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "1400",
      titles: `File:${page.pageimage}`,
    }).toString();
    const commons = await fetchJson(commonsUrl, options);
    const info = commons.query?.pages?.[0]?.imageinfo?.[0];
    const metadata = info?.extmetadata ?? {};
    resolvedUrl = safeHttpsUrl(info?.thumburl, true) || imageUrl;
    resolvedSource = safeHttpsUrl(info?.descriptionurl) || sourceUrl;
    creator = plainText(metadata.Artist?.value) || plainText(metadata.Credit?.value) || creator;
    license = plainText(metadata.LicenseShortName?.value) || plainText(metadata.UsageTerms?.value) || license;
    licenseUrl = safeHttpsUrl(metadata.LicenseUrl?.value);
    width = Number(info?.thumbwidth ?? width);
    height = Number(info?.thumbheight ?? height);
  } catch {
    // The canonical page image remains usable even if Commons metadata is temporarily unavailable.
  }
  if (!(await probeImageUrl(resolvedUrl, options))) return null;
  return {
    url: resolvedUrl,
    sourceUrl: resolvedSource,
    title: clamp(String(page.title || canonical), 110),
    creator: clamp(creator, 90),
    license: clamp(license, 80),
    licenseUrl,
    provider: "Wikimedia",
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  };
}

function imageScore(result: Record<string, any>, query: string, preferredAspect: ResolveImageOptions["preferredAspect"]) {
  const normalizedQuery = query.toLowerCase();
  const title = String(result.title ?? "").toLowerCase();
  const width = Number(result.width ?? 0);
  const height = Number(result.height ?? 0);
  const ratio = width > 0 && height > 0 ? width / height : 1;
  let score = title === normalizedQuery ? 80 : title.includes(normalizedQuery) ? 38 : 0;
  if (String(result.source ?? "") === "wikimedia") score += 5;
  if (width >= 600 && height >= 400) score += 4;
  if (preferredAspect === "portrait" && ratio < .9) score += 10;
  if (preferredAspect === "landscape" && ratio > 1.25) score += 10;
  if (preferredAspect === "square" && ratio >= .82 && ratio <= 1.18) score += 10;
  return score;
}

async function resolveOpenverse(query: string, options: ResolveImageOptions): Promise<ResolvedImage | null> {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.search = new URLSearchParams({ q: query, page_size: "12", mature: "false" }).toString();
  const payload = await fetchJson(url, options);
  const results = Array.isArray(payload.results) ? payload.results as Record<string, any>[] : [];
  const candidates = results
    .filter((result) => result.mature !== true && safeHttpsUrl(result.thumbnail, true) && safeHttpsUrl(result.foreign_landing_url))
    .sort((left, right) => imageScore(right, query, options.preferredAspect) - imageScore(left, query, options.preferredAspect));
  const checked = await Promise.all(candidates.slice(0, 5).map(async (candidate) => ({ candidate, healthy: await probeImageUrl(String(candidate.thumbnail), options) })));
  const result = checked.find((entry) => entry.healthy)?.candidate;
  if (!result) return null;
  const license = [String(result.license ?? "").toUpperCase(), String(result.license_version ?? "")].filter(Boolean).join(" ") || "See source";
  return {
    url: safeHttpsUrl(result.thumbnail, true),
    sourceUrl: safeHttpsUrl(result.foreign_landing_url),
    title: clamp(String(result.title || query), 110),
    creator: clamp(String(result.creator || "Openverse contributor"), 90),
    license: clamp(license, 80),
    licenseUrl: safeHttpsUrl(result.license_url),
    provider: "Openverse",
    width: Number(result.width ?? 0),
    height: Number(result.height ?? 0),
  };
}

export async function resolveImageQuery(query: string, options: ResolveImageOptions = {}): Promise<ResolvedImage | null> {
  const clean = clamp(query, 80);
  if (!clean) return null;
  const key = `${clean.toLowerCase()}|${options.preferredAspect ?? "natural"}`;
  if (options.cache !== false) {
    const cached = imageCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    imageCache.delete(key);
  }
  let value: ResolvedImage | null = null;
  try {
    value = await resolveWikimedia(clean, options);
  } catch {
    // Descriptive searches normally miss exact Wikipedia titles and fall through to Openverse.
  }
  if (!value && !options.signal?.aborted) {
    try {
      value = await resolveOpenverse(clean, options);
    } catch {
      value = null;
    }
  }
  if (options.cache !== false)
    imageCache.set(key, {
      expiresAt:
        Date.now() + (value ? positiveCacheTtlMs : negativeCacheTtlMs),
      value,
    });
  return value;
}

function preferredAspect(node: UINode): NonNullable<ResolveImageOptions["preferredAspect"]> {
  if (node.variant === "portrait" || node.variant === "landscape" || node.variant === "square") return node.variant;
  return "natural";
}

export async function enrichExperienceImages(experience: UIExperience, options: EnrichExperienceOptions = {}): Promise<UIExperience> {
  const nodes = await Promise.all(experience.nodes.map(async (node) => {
    if (node.type !== "Image") return node;
    const candidates = [...new Set([node.label.trim(), node.title.trim()].filter(Boolean))];
    let image: ResolvedImage | null = null;
    for (const query of candidates) {
      image = await resolveImageQuery(query, {
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
        preferredAspect: preferredAspect(node),
        cache: !options.fetchImpl,
      });
      if (image) break;
    }
    if (
      !image &&
      node.mediaRole === "illustration" &&
      options.apiKey &&
      process.env.FIFY_GENERATE_IMAGES !== "0" &&
      !options.signal?.aborted
    )
      image = await generateExplanatoryImage(
        candidates[0] || node.text || node.title,
        options.apiKey,
        options,
      );
    const resolved = uiNodeSchema.parse(image ? {
      ...node,
      value:
        image.provider === "Generated" ? image.url : localImageUrl(image.url),
      meta: image.provider,
      items: [{
        id: `${node.id.slice(0, 46)}-credit`,
        label: clamp(image.creator || image.title, 90),
        value: clamp(image.license, 120),
        detail: image.sourceUrl,
        tone: "neutral",
        progress: null,
      }],
    } : { ...node, value: "", meta: "Unavailable", items: [] });
    await options.onResolved?.(resolved);
    return resolved;
  }));
  return uiExperienceSchema.parse({ ...experience, nodes });
}

async function generateExplanatoryImage(
  subject: string,
  apiKey: string,
  options: EnrichExperienceOptions,
): Promise<ResolvedImage | null> {
  const clean = clamp(subject, 180);
  if (!clean) return null;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
      method: "POST",
      ...(options.signal ? { signal: options.signal } : {}),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.FIFY_IMAGE_MODEL || "gpt-image-2",
        prompt: `Create a clear editorial illustration that helps a general reader understand: ${clean}. No labels, logos, UI chrome, decorative gradients, or photorealistic documentary claims. Use a simple composition with one focal idea.`,
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string }>;
    };
    const encoded = payload.data?.[0]?.b64_json;
    if (!encoded) return null;
    const bytes = Uint8Array.from(Buffer.from(encoded, "base64"));
    if (!bytes.length || bytes.length > 12 * 1024 * 1024) return null;
    const id = storeGeneratedMedia(bytes);
    return {
      url: `/api/media/image?id=${encodeURIComponent(id)}`,
      sourceUrl: "",
      title: clean,
      creator: "Fify",
      license: "AI-generated",
      licenseUrl: "",
      provider: "Generated",
      width: 1024,
      height: 1024,
    };
  } catch {
    return null;
  }
}
