import { describe, expect, it, vi } from "vitest";
import { representationPlanSchema, uiExperienceSchema, uiLanguageFixture } from "@fify/core";
import {
  enrichExperienceImages,
  isAllowedRemoteImageUrl,
  resolveImageQuery,
} from "./image-search";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

describe("trusted image search", () => {
  it("keeps the media boundary on a small explicit host allowlist", () => {
    expect(isAllowedRemoteImageUrl("https://upload.wikimedia.org/example.jpg")).toBe(true);
    expect(isAllowedRemoteImageUrl("https://api.openverse.org/v1/images/example/thumb/")).toBe(true);
    expect(isAllowedRemoteImageUrl("https://private.example/image.jpg")).toBe(false);
    expect(isAllowedRemoteImageUrl("http://upload.wikimedia.org/example.jpg")).toBe(false);
  });
  it("resolves canonical entities through Wikipedia with Commons attribution", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("en.wikipedia.org")) return json({ query: { pages: [{ title: "Steve Jobs", fullurl: "https://en.wikipedia.org/wiki/Steve_Jobs", pageimage: "Steve_Jobs.jpg", thumbnail: { source: "https://upload.wikimedia.org/steve.jpg", width: 900, height: 1200 } }] } });
      if (url.includes("upload.wikimedia.org"))
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/jpeg" },
        });
      return json({ query: { pages: [{ imageinfo: [{ thumburl: "https://upload.wikimedia.org/steve-thumb.jpg", thumbwidth: 900, thumbheight: 1200, descriptionurl: "https://commons.wikimedia.org/wiki/File:Steve_Jobs.jpg", extmetadata: { Artist: { value: "<a>Matthew Yohe</a>" }, LicenseShortName: { value: "CC BY-SA 3.0" }, LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/3.0" } } }] }] } });
    });
    await expect(resolveImageQuery("Steve Jobs portrait", { fetchImpl: fetchImpl as typeof fetch, preferredAspect: "portrait", cache: false })).resolves.toMatchObject({
      provider: "Wikimedia",
      creator: "Matthew Yohe",
      license: "CC BY-SA 3.0",
      url: "https://upload.wikimedia.org/steve-thumb.jpg",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("falls back to Openverse for descriptive searches", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("wikipedia.org")) return json({ query: { pages: [{ missing: true, title: "Red fox in snow" }] } });
      if (init?.method === "GET") return new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "image/jpeg" } });
      return json({ results: [{ title: "Red fox in snow", thumbnail: "https://api.openverse.org/v1/images/fox/thumb/", foreign_landing_url: "https://www.flickr.com/photos/example/fox", creator: "A. Photographer", license: "by", license_version: "4.0", license_url: "https://creativecommons.org/licenses/by/4.0/", mature: false, width: 1200, height: 800 }] });
    });
    await expect(resolveImageQuery("Red fox in snow", { fetchImpl: fetchImpl as typeof fetch, preferredAspect: "landscape", cache: false })).resolves.toMatchObject({
      provider: "Openverse",
      creator: "A. Photographer",
      license: "BY 4.0",
    });
  });

  it("skips broken Openverse thumbnails and selects the next healthy candidate", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("wikipedia.org")) return json({ query: { pages: [{ missing: true }] } });
      if (init?.method === "GET") return new Response(url.includes("broken") ? null : new Uint8Array([1]), { status: url.includes("broken") ? 424 : 200, headers: { "content-type": url.includes("broken") ? "application/json" : "image/jpeg" } });
      return json({ results: [
        { title: "Red fox in snow", thumbnail: "https://api.openverse.org/v1/images/broken/thumb/", foreign_landing_url: "https://example.com/broken", creator: "Broken", license: "by", mature: false, width: 1200, height: 800 },
        { title: "Red fox on snow", thumbnail: "https://api.openverse.org/v1/images/healthy/thumb/", foreign_landing_url: "https://example.com/healthy", creator: "Healthy Photographer", license: "by", mature: false, width: 1200, height: 800 },
      ] });
    });
    await expect(resolveImageQuery("Red fox in snow", { fetchImpl: fetchImpl as typeof fetch, cache: false })).resolves.toMatchObject({
      url: "https://api.openverse.org/v1/images/healthy/thumb/",
      creator: "Healthy Photographer",
    });
  });

  it("enriches only Image nodes and emits a resolved update", async () => {
    const root = structuredClone(uiLanguageFixture.nodes[0]!);
    root.children = ["portrait"];
    const image = { ...structuredClone(uiLanguageFixture.nodes[1]!), id: "portrait", type: "Image" as const, variant: "portrait" as const, label: "Steve Jobs", title: "Portrait of Steve Jobs", value: "", meta: "", items: [], children: [] };
    image.slot = "primary";
    const representation = representationPlanSchema.parse({ ...uiLanguageFixture.representation, informationShapes: ["media-artifact"], slots: [{ id: "primary", role: "primary", shape: "media-artifact", priority: "primary", required: true }] });
    const experience = uiExperienceSchema.parse({ ...uiLanguageFixture, representation, responseId: "image-test", nodes: [root, image], suggestions: [] });
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const value = String(input);
      if (value.includes("en.wikipedia.org"))
        return json({ query: { pages: [{ title: "Steve Jobs", fullurl: "https://en.wikipedia.org/wiki/Steve_Jobs", pageimage: "Steve_Jobs.jpg", thumbnail: { source: "https://upload.wikimedia.org/steve.jpg", width: 900, height: 1200 } }] } });
      if (value.includes("upload.wikimedia.org"))
        return new Response(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } });
      return json({ query: { pages: [{ imageinfo: [{ thumburl: "https://upload.wikimedia.org/steve-thumb.jpg", descriptionurl: "https://commons.wikimedia.org/wiki/File:Steve_Jobs.jpg", extmetadata: {} }] }] } });
    });
    const onResolved = vi.fn();
    const enriched = await enrichExperienceImages(experience, { fetchImpl: fetchImpl as typeof fetch, onResolved });
    expect(enriched.nodes[1]).toMatchObject({ type: "Image", meta: "Wikimedia" });
    expect(enriched.nodes[1]?.value).toContain("/api/media/image?src=");
    expect(enriched.nodes[1]?.items[0]?.detail).toContain("commons.wikimedia.org");
    expect(onResolved).toHaveBeenCalledOnce();
  });

  it("generates only explanatory illustrations when public search has no result", async () => {
    const root = structuredClone(uiLanguageFixture.nodes[0]!);
    root.children = ["concept-art"];
    const image = {
      ...structuredClone(uiLanguageFixture.nodes[1]!),
      id: "concept-art",
      type: "Image" as const,
      mediaRole: "illustration" as const,
      label: "How compound interest accelerates",
      title: "Compounding visualized as accelerating growth",
      value: "",
      meta: "",
      items: [],
      children: [],
      slot: "primary",
    };
    const representation = representationPlanSchema.parse({
      ...uiLanguageFixture.representation,
      informationShapes: ["media-artifact"],
      slots: [{ id: "primary", role: "primary", shape: "media-artifact", priority: "primary", required: true }],
    });
    const experience = uiExperienceSchema.parse({
      ...uiLanguageFixture,
      representation,
      responseId: "generated-image-test",
      nodes: [root, image],
      suggestions: [],
    });
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const value = String(input);
      if (value.includes("wikipedia.org"))
        return json({ query: { pages: [{ missing: true }] } });
      if (value.includes("api.openverse.org")) return json({ results: [] });
      if (value.includes("api.openai.com"))
        return json({ data: [{ b64_json: Buffer.from("generated").toString("base64") }] });
      return new Response(null, { status: 404 });
    });
    const enriched = await enrichExperienceImages(experience, {
      fetchImpl: fetchImpl as typeof fetch,
      apiKey: "test-key",
    });
    expect(enriched.nodes[1]).toMatchObject({
      type: "Image",
      meta: "Generated",
    });
    expect(enriched.nodes[1]?.value).toMatch(/^\/api\/media\/image\?id=/);
  });
});
