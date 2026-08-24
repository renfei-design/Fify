import { describe, expect, it } from "vitest";
import { createA2UIRenderer } from "./index.js";

describe("@fify/react", () => {
  it("exposes the trusted registry renderer", () => {
    expect(createA2UIRenderer).toBeTypeOf("function");
  });
});
