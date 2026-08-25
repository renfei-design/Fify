import { describe, expect, it, vi } from "vitest";
import {
  compileGroundedInformationUI,
  createDefaultGroundedCompositionPlan,
  type InformationEnvelopeV1,
} from "@fify/core";
import {
  enrichInformationEnvelopeWithProfileMedia,
  profileSubjectForEnvelope,
} from "./profile-media.js";

const profileEnvelope: InformationEnvelopeV1 = {
  version: "1.0",
  originalRequest: "Who is Steve Jobs?",
  groundedAnswer:
    "Steve Jobs was an American entrepreneur who co-founded Apple.",
  locale: "en-US",
  profileSubject: "Steve Jobs",
  sections: [
    {
      id: "identity",
      title: "Steve Jobs",
      body: "An American entrepreneur and product leader.",
      sourceIds: [],
      items: [
        {
          id: "known-for",
          label: "Known for",
          value: "Apple co-founder",
          detail: "He helped shape several generations of personal technology.",
          sourceIds: [],
        },
        {
          id: "lived",
          label: "Lived",
          value: "1955–2011",
          detail: "Born February 24, 1955; died October 5, 2011.",
          sourceIds: [],
        },
      ],
    },
  ],
  sources: [],
  suggestedRefinements: [],
};

function wikimediaFetch() {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "en.wikipedia.org")
      return Response.json({
        query: {
          pages: [
            {
              pageid: 7412236,
              title: "Steve Jobs",
              fullurl: "https://en.wikipedia.org/wiki/Steve_Jobs",
              pageimage: "Steve_Jobs_Headshot_2010-CROP_(cropped_2).jpg",
            },
          ],
        },
      });
    if (url.hostname === "commons.wikimedia.org")
      return Response.json({
        query: {
          pages: [
            {
              title: "File:Steve Jobs Headshot 2010-CROP (cropped 2).jpg",
              imageinfo: [
                {
                  thumburl:
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Steve_Jobs_Headshot_2010-CROP_%28cropped_2%29.jpg/960px-Steve_Jobs_Headshot_2010-CROP_%28cropped_2%29.jpg",
                  descriptionurl:
                    "https://commons.wikimedia.org/wiki/File:Steve_Jobs_Headshot_2010-CROP_(cropped_2).jpg",
                  extmetadata: {
                    Artist: { value: "<a>Matthew Yohe</a>" },
                    LicenseShortName: { value: "CC BY-SA 3.0" },
                  },
                },
              ],
            },
          ],
        },
      });
    return new Response(null, { status: 404 });
  });
}

describe("trusted profile media enrichment", () => {
  it("infers explicit named-person requests and honors no-image instructions", () => {
    const inferred = structuredClone(profileEnvelope);
    delete inferred.profileSubject;
    expect(profileSubjectForEnvelope(inferred)).toBe("Steve Jobs");

    inferred.originalRequest = "Who is Steve Jobs? Do not include a portrait.";
    expect(profileSubjectForEnvelope(inferred)).toBeNull();
  });

  it("resolves an attributed portrait and activates the profile-reference layout", async () => {
    const fetchImpl = wikimediaFetch();
    const enriched = await enrichInformationEnvelopeWithProfileMedia(
      profileEnvelope,
      { fetchImpl, cache: false },
    );
    const plan = createDefaultGroundedCompositionPlan(enriched);
    const compiled = compileGroundedInformationUI(
      enriched,
      plan,
      "profile-run",
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(enriched.media).toEqual([
      expect.objectContaining({
        role: "identity",
        alt: "Portrait of Steve Jobs",
        caption: "Matthew Yohe · CC BY-SA 3.0",
        sourceId: "profile-portrait-source",
      }),
    ]);
    expect(enriched.sources).toEqual([
      expect.objectContaining({
        id: "profile-portrait-source",
        url: expect.stringContaining("commons.wikimedia.org/wiki/File:"),
      }),
    ]);
    expect(plan.topology).toBe("focal-split");
    expect(compiled.experience.representation.blueprintIds).toEqual([
      "profile-reference",
    ]);
    expect(
      compiled.experience.nodes.find((node) => node.mediaRole === "identity"),
    ).toMatchObject({
      type: "Image",
      value: expect.stringContaining("upload.wikimedia.org"),
      variant: "portrait",
    });
  });

  it("keeps the grounded answer usable when trusted media is unavailable", async () => {
    const enriched = await enrichInformationEnvelopeWithProfileMedia(
      profileEnvelope,
      {
        fetchImpl: vi.fn<typeof fetch>(
          async () => new Response(null, { status: 503 }),
        ),
        cache: false,
      },
    );

    expect(enriched.media).toBeUndefined();
    expect(enriched.groundedAnswer).toBe(profileEnvelope.groundedAnswer);
    expect(createDefaultGroundedCompositionPlan(enriched).topology).toBe(
      "editorial-stack",
    );
  });
});
