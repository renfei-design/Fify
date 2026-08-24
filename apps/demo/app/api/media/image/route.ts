import { NextRequest } from "next/server";
import { isAllowedRemoteImageUrl } from "../../../../lib/image-search";
import { readGeneratedMedia } from "../../../../lib/media-store";

export const dynamic = "force-dynamic";

const maxImageBytes = 12 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function imageResponse(bytes: Uint8Array, mimeType: string) {
  const body = Uint8Array.from(bytes).buffer;
  return new Response(body, {
    headers: {
      "content-type": mimeType,
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (id) {
    const media = readGeneratedMedia(id);
    return media
      ? imageResponse(media.bytes, media.mimeType)
      : new Response(null, { status: 404 });
  }

  const source = request.nextUrl.searchParams.get("src") ?? "";
  if (!isAllowedRemoteImageUrl(source))
    return new Response(null, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(source, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
        "user-agent":
          "Fify/0.4 (open-source generative UI framework; media proxy)",
      },
    });
    const mimeType = (response.headers.get("content-type") ?? "")
      .split(";", 1)[0]!
      .toLowerCase();
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (
      !response.ok ||
      !isAllowedRemoteImageUrl(response.url) ||
      !allowedMimeTypes.has(mimeType) ||
      (declaredLength && declaredLength > maxImageBytes)
    )
      return new Response(null, { status: 502 });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > maxImageBytes)
      return new Response(null, { status: 502 });
    return imageResponse(bytes, mimeType);
  } catch {
    return new Response(null, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
