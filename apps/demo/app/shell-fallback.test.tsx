import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UniversalDemo } from "../components/universal-demo";
import RootLayout from "./layout";
import Loading from "./loading";

describe("root shell fallback", () => {
  it("owns the full document canvas before the client app renders", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <div>Client route</div>
      </RootLayout>,
    );

    expect(markup).toContain('class="dark"');
    expect(markup).toContain('style="background:#171717"');
    expect(markup).toContain('class="fify-shell-backdrop"');
    expect(markup).toContain('class="fify-route-content"');
    expect(markup).toContain("Client route");
  });

  it("renders a visible and announced route loading state", () => {
    const markup = renderToStaticMarkup(<Loading />);

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Preparing Fify");
    expect(markup).toContain("conversation shell will remain visible");
  });

  it("keeps the home action inside the client shell", () => {
    const markup = renderToStaticMarkup(<UniversalDemo />);
    const homeControl = markup.match(
      /<(button|a)[^>]*aria-label="Fify home"[^>]*>/,
    )?.[0];

    expect(homeControl).toMatch(/^<button/);
    expect(homeControl).not.toContain("href=");
  });
});
