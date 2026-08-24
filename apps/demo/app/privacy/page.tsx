import type { Metadata } from "next";
import "../chatgpt/launch.css";

export const metadata: Metadata = { title: "Privacy Policy — Fify" };

export default function PrivacyPage() {
  return <main className="fify-policy"><article><a className="fify-policy__back" href="/chatgpt">← Fify for ChatGPT</a><h1>Privacy Policy</h1><p className="fify-policy__date">Effective August 24, 2026</p>
    <p>This policy explains how the Fify ChatGPT app handles information when it turns a grounded answer into an interactive view.</p>
    <h2>Information Fify receives</h2><ul><li>The request, answer, structured sections, source links, optional media links, locale, and continuation state that ChatGPT sends to the Fify rendering tool.</li><li>Limited host metadata used to create a one-way quota bucket. Fify does not need your name, email address, or ChatGPT account credentials.</li><li>Standard operational data collected by our hosting provider, such as IP address, request time, response status, and user agent, for security and reliability.</li></ul>
    <h2>How information is used</h2><p>We use this information only to validate, compose, render, secure, and troubleshoot the requested interactive view. Fify does not sell personal information, use it for advertising, or use submitted content to train Fify models.</p>
    <h2>Processing and sharing</h2><p>The production app uses a deterministic, catalog-constrained renderer. Information is processed by our hosting infrastructure and is not sent to unrelated third parties. Source and media links may be opened by your ChatGPT client when it displays the view.</p>
    <h2>Retention</h2><p>Render data is held only in short-lived process memory and is configured to expire within one hour. Quota counters and one-way identifiers may remain in process memory until the hosting instance is recycled. Infrastructure security logs may be retained by the hosting provider according to its standard retention settings.</p>
    <h2>Security and choices</h2><p>Fify validates tool inputs, restricts remote media to declared domains, and renders only catalog-approved components. Do not send highly sensitive personal information to Fify. You can stop processing by not invoking the app, remove the app from ChatGPT, or ask ChatGPT to keep the answer in plain text.</p>
    <h2>Contact</h2><p>For privacy requests or questions, use the <a href="/support">Fify support page</a>. We may update this policy as the service changes and will post the revised effective date here.</p>
  </article></main>;
}
