import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createA2UIRenderer } from "./index.js";

describe("createA2UIRenderer", () => {
  it("renders a validated surface through an application-owned catalog", () => {
    const Renderer = createA2UIRenderer<{ suffix: string }>({
      catalogId: "trusted",
      components: {
        Column: ({ children }) => <main>{children}</main>,
        Metric: ({ component, context }) => (
          <strong>
            {String(component.label)}
            {context.suffix}
          </strong>
        ),
      },
    });

    const html = renderToStaticMarkup(
      <Renderer
        context={{ suffix: "!" }}
        surface={{
          surfaceId: "test",
          catalogId: "trusted",
          sendDataModel: false,
          components: {
            root: { id: "root", component: "Column", children: ["answer"] },
            answer: { id: "answer", component: "Metric", label: "Ready" },
          },
          dataModel: {},
        }}
      />,
    );
    expect(html).toContain("Ready!");
  });

  it("rejects an unsupported catalog", () => {
    const Renderer = createA2UIRenderer({
      catalogId: "trusted",
      components: { Column: ({ children }) => <main>{children}</main> },
    });

    expect(() =>
      renderToStaticMarkup(
        <Renderer
          context={{}}
          surface={{
            surfaceId: "test",
            catalogId: "untrusted",
            sendDataModel: false,
            components: { root: { id: "root", component: "Column" } },
            dataModel: {},
          }}
        />,
      ),
    ).toThrow("not supported");
  });

  it("renders a placeholder for a streamed reference that has not arrived", () => {
    const Renderer = createA2UIRenderer({
      catalogId: "trusted",
      renderPendingComponent: (id) => <div>Loading {id}</div>,
      components: { Column: ({ children }) => <main>{children}</main> },
    });

    const html = renderToStaticMarkup(
      <Renderer
        context={{}}
        surface={{
          surfaceId: "progressive",
          catalogId: "trusted",
          sendDataModel: false,
          components: {
            root: { id: "root", component: "Column", children: ["answer"] },
          },
          dataModel: {},
        }}
      />,
    );
    expect(html).toContain("Loading answer");
  });
});
