import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storeGeneratedMedia } from "../../../../lib/media-store";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("trusted media delivery route", () => {
  it("serves short-lived generated media by opaque ID", async () => {
    const id = storeGeneratedMedia(new Uint8Array([1, 2, 3]));
    const response = await GET(
      new NextRequest(`http://localhost/api/media/image?id=${id}`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("proxies only verified image responses from approved providers", async () => {
    const source = "https://upload.wikimedia.org/example.jpg";
    const upstream = new Response(new Uint8Array([4, 5, 6]), {
      headers: { "content-type": "image/jpeg", "content-length": "3" },
    });
    Object.defineProperty(upstream, "url", { value: source });
    const fetchImpl = vi.fn(async () => upstream);
    vi.stubGlobal("fetch", fetchImpl);
    const response = await GET(
      new NextRequest(
        `http://localhost/api/media/image?src=${encodeURIComponent(source)}`,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects arbitrary remote hosts before making a request", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    const response = await GET(
      new NextRequest(
        "http://localhost/api/media/image?src=https%3A%2F%2Fprivate.example%2Fsecret.png",
      ),
    );
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
