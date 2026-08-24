import { describe, expect, it } from "vitest";
import { uiNodeTypes } from "./language.js";
import {
  informationUISurfaceFamilyForType,
  informationUIThemeCssVariables,
  informationUIWebThemeStyle,
} from "./presentation.js";

describe("shared information UI presentation", () => {
  it("classifies every semantic catalog node", () => {
    for (const type of uiNodeTypes) expect(informationUISurfaceFamilyForType(type)).toBeTruthy();
    expect(informationUISurfaceFamilyForType("FactList")).toBe("facts");
    expect(informationUISurfaceFamilyForType("Comparison")).toBe("comparison");
    expect(informationUISurfaceFamilyForType("Timeline")).toBe("timeline");
  });

  it("emits adaptive MCP variables and matching web variables", () => {
    const css = informationUIThemeCssVariables();
    expect(css).toContain("--gx-accent:light-dark(");
    expect(css).toContain("--gx-panel:");
    const web = informationUIWebThemeStyle();
    expect(web["--ui-primary"]).toContain("oklch");
    expect(web["--ui-card"]).toContain("oklch");
  });
});
