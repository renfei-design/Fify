import type { Metadata } from "next";
import "../chatgpt/launch.css";

export const metadata: Metadata = { title: "Support — Fify" };

export default function SupportPage() {
  return <main className="fify-policy"><article><a className="fify-policy__back" href="/chatgpt">← Fify for ChatGPT</a><h1>Support</h1><p>Fify should keep the complete answer available even if its interactive view cannot load.</p>
    <h2>Try these steps first</h2><ol><li>Ask ChatGPT to render the answer with Fify again.</li><li>Remove optional media or ask for a plain comparison, checklist, or timeline.</li><li>Confirm the answer contains the facts and sources the view should use.</li><li>If the problem persists, remove and reinstall Fify from ChatGPT.</li></ol>
    <h2>Report an issue</h2><p>Send a support request from the contact method shown on Fify’s ChatGPT marketplace listing. Include the approximate time, the prompt you used with sensitive details removed, what you expected, what happened, and a screenshot if available. Never include passwords, API keys, or private credentials.</p>
    <h2>Service status</h2><p>The MCP service exposes a machine-readable <a href="/api/healthz">health check</a>. A successful response means the public endpoint is reachable; it does not guarantee that every individual render will succeed.</p>
  </article></main>;
}
