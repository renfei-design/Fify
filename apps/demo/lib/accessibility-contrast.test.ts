import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  extractOklchThemeTokens,
} from "./accessibility-contrast";

const themeCss = readFileSync(
  new URL("../app/shadcn.css", import.meta.url),
  "utf8",
);
const colors = extractOklchThemeTokens(themeCss);

function expectTextContrast(foreground: string, background: string) {
  expect(colors[foreground], `${foreground} token`).toBeDefined();
  expect(colors[background], `${background} token`).toBeDefined();
  expect(
    contrastRatio(colors[foreground]!, colors[background]!),
    `${foreground} on ${background}`,
  ).toBeGreaterThanOrEqual(4.5);
}

describe("shadcn theme contrast", () => {
  it("keeps every normal-text token pair at WCAG AA contrast", () => {
    expectTextContrast("foreground", "background");
    expectTextContrast("foreground", "card");
    expectTextContrast("muted-foreground", "background");
    expectTextContrast("muted-foreground", "card");
    expectTextContrast("primary", "background");
    expectTextContrast("primary-foreground", "primary");
    expectTextContrast("secondary-foreground", "secondary");
    expectTextContrast("accent-foreground", "accent");
    expectTextContrast("destructive", "background");
    expectTextContrast("destructive-foreground", "destructive");
  });
});
