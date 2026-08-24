import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { handleFifyMcpRequest } from "./http.js";

const client = new Client({ name: "fify-http-test", version: "1.0.0" }, { capabilities: {} });
let transport: StreamableHTTPClientTransport;
let previousApiKey: string | undefined;

beforeAll(async () => {
  previousApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  transport = new StreamableHTTPClientTransport(new URL("https://fify.test/api/mcp"), {
    fetch: (input, init) => handleFifyMcpRequest(new Request(input, init)),
  });
  await client.connect(transport as unknown as Parameters<typeof client.connect>[0]);
});

afterAll(async () => {
  if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousApiKey;
  await client.close();
});

describe("Fify stateless HTTP transport", () => {
  it("initializes and exposes the renderer over Streamable HTTP", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "render_information_ui",
      "read_information_ui_run",
    ]);
  });

  it("answers CORS preflight requests", async () => {
    const response = await handleFifyMcpRequest(new Request("https://fify.test/api/mcp", { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
