import type { Metadata } from "next";
import "../chatgpt/launch.css";

export const metadata: Metadata = { title: "Terms of Use — Fify" };

export default function TermsPage() {
  return <main className="fify-policy"><article><a className="fify-policy__back" href="/chatgpt">← Fify for ChatGPT</a><h1>Terms of Use</h1><p className="fify-policy__date">Effective August 24, 2026</p>
    <p>These terms apply to the Fify ChatGPT app provided by the developer identified on its ChatGPT app listing (“Fify”, “we”, or “us”). By using Fify, you agree to these terms.</p>
    <h2>What Fify does</h2><p>Fify transforms a grounded ChatGPT answer into a non-consequential interactive information view. Fify is a presentation layer: the plain-language answer remains the authoritative fallback.</p>
    <h2>Permitted use</h2><p>You may use Fify for lawful personal or business information tasks. You may not misuse the service, interfere with its operation, bypass limits, probe for vulnerabilities without authorization, or use it to violate another person’s rights.</p>
    <h2>Important decisions</h2><p>Fify is not a substitute for professional medical, legal, financial, safety, or other expert advice. Do not rely on an interactive view alone for consequential decisions. Review the underlying answer and cited sources.</p>
    <h2>Your content</h2><p>You retain the rights you have in content you submit. You grant us only the limited permission needed to process that content and provide the requested view. You are responsible for having the right to submit it.</p>
    <h2>Availability and changes</h2><p>Fify may change, impose reasonable limits, suspend abusive access, or be discontinued. We aim for reliable service but do not promise uninterrupted or error-free operation.</p>
    <h2>Disclaimers and liability</h2><p>To the extent permitted by law, Fify is provided “as is” without implied warranties. We are not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the app. Nothing in these terms limits rights or liabilities that cannot legally be limited.</p>
    <h2>Contact</h2><p>Questions about these terms can be sent through the <a href="/support">Fify support page</a>. If we materially update these terms, we will post a new effective date.</p>
  </article></main>;
}
