export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", service: "fify-chatgpt", version: "0.1.0" });
}
