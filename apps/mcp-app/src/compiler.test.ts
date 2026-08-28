import { afterEach, describe, expect, it } from "vitest";
import {
  compileGroundedInformationUI,
  type InformationEnvelopeV1,
} from "@fify/core";
import { compileInformationUIRun } from "./compiler.js";
import { InformationUIRunStore } from "./run-store.js";

const previousApiKey = process.env.OPENAI_API_KEY;
const previousComposerFlag = process.env.FIFY_ENABLE_MODEL_COMPOSER;

afterEach(() => {
  if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousApiKey;
  if (previousComposerFlag === undefined) delete process.env.FIFY_ENABLE_MODEL_COMPOSER;
  else process.env.FIFY_ENABLE_MODEL_COMPOSER = previousComposerFlag;
});

const envelope: InformationEnvelopeV1 = {
  version: "1.0",
  originalRequest: "Compare tea and coffee.",
  groundedAnswer: "Tea and coffee use different brewing sources.",
  locale: "en-US",
  sections: [{
    id: "sources",
    title: "Brewing sources",
    body: "Compare the supplied facts.",
    sourceIds: [],
    items: [
      { id: "tea", label: "Tea", value: "Leaves", detail: "Brewed from leaves.", sourceIds: [] },
      { id: "coffee", label: "Coffee", value: "Beans", detail: "Brewed from roasted beans.", sourceIds: [] },
    ],
  }],
  sources: [],
  suggestedRefinements: [],
};

describe("information UI compiler latency policy", () => {
  it("uses the immediate local compiler unless model composition is explicitly enabled", async () => {
    process.env.OPENAI_API_KEY = "an-unrelated-inherited-key";
    delete process.env.FIFY_ENABLE_MODEL_COMPOSER;
    const store = new InformationUIRunStore();
    const run = store.findOrCreate("compiler-test", envelope).run;

    await compileInformationUIRun(store, run.id, envelope);

    const result = store.read(run.id, 0)!;
    expect(result.state).toBe("complete");
    expect(result.frames).toContainEqual(expect.objectContaining({
      type: "status",
      stage: "fallback",
      message: "Using the immediate local grounded layout.",
    }));
    expect(result.frames).toContainEqual(expect.objectContaining({
      type: "complete",
      compilerMode: "deterministic-fallback",
    }));
  });

  it("retries compilation without optional media instead of failing the interactive view", async () => {
    const withMedia: InformationEnvelopeV1 = {
      ...envelope,
      sources: [
        {
          id: "product-source",
          title: "Product source",
          url: "https://www.apple.com/product/",
        },
      ],
      media: [
        {
          id: "product-image",
          url: "https://www.apple.com/images/product.jpg",
          alt: "Product",
          caption: "Official product image",
          role: "illustration",
          sourceId: "product-source",
        },
      ],
    };
    const store = new InformationUIRunStore();
    const run = store.findOrCreate("compiler-media-fallback", withMedia).run;

    await compileInformationUIRun(store, run.id, withMedia, {
      compile: (candidate, composition, responseId) => {
        if (candidate.media?.length) {
          throw new Error("Synthetic media-layout incompatibility.");
        }
        return compileGroundedInformationUI(
          candidate,
          composition,
          responseId,
        );
      },
    });

    const result = store.read(run.id, 0)!;
    expect(result.state).toBe("complete");
    expect(result.frames).toContainEqual(
      expect.objectContaining({
        type: "status",
        stage: "fallback",
        message: expect.stringContaining(
          "continuing with the complete interactive view without imagery",
        ),
      }),
    );
    expect(result.frames).toContainEqual(
      expect.objectContaining({
        type: "complete",
        envelope: expect.objectContaining({ media: [] }),
      }),
    );
  });
});
