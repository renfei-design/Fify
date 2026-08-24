import { handleFifyMcpRequest } from "@fify/mcp-app/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handleFifyMcpRequest;
export const POST = handleFifyMcpRequest;
export const DELETE = handleFifyMcpRequest;
export const OPTIONS = handleFifyMcpRequest;
