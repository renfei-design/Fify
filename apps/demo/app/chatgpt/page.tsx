import type { Metadata } from "next";
import "./launch.css";

export const metadata: Metadata = {
  title: "Fify for ChatGPT — From answer to action",
  description: "Turn complex ChatGPT answers into interactive comparisons, plans, checklists, timelines, and decision views.",
};

const examples = [
  { label: "Compare", title: "See tradeoffs, clearly", body: "Turn dense option research into a structured comparison you can scan and select.", prompt: "Compare these options by cost, risk, and time to value." },
  { label: "Plan", title: "Make the answer workable", body: "Convert a rollout or project answer into an interactive checklist with grounded next steps.", prompt: "Turn this rollout plan into a checklist I can work through." },
  { label: "Understand", title: "Give complexity a shape", body: "Map milestones, evidence, and dependencies into timelines and explorable information views.", prompt: "Show these milestones as a timeline with risks and next steps." },
];

export default function ChatGPTLaunchPage() {
  return <main className="fify-launch">
    <nav className="fify-launch__nav">
      <a className="fify-launch__brand" href="/chatgpt"><img src="/brand/fify-mark.svg" alt="" />Fify</a>
      <div className="fify-launch__navlinks"><a href="#examples">Examples</a><a href="#trust">Trust</a><a href="/support">Support</a></div>
    </nav>
    <div className="fify-launch__main">
      <section className="fify-launch__hero">
        <span className="fify-launch__eyebrow">Fify for ChatGPT</span>
        <h1>From answer<br />to action.</h1>
        <p className="fify-launch__lede">Fify turns grounded ChatGPT answers into interactive comparisons, plans, checklists, timelines, and decision views—without replacing the answer you trust.</p>
      </section>
      <section className="fify-launch__prompts" id="examples" aria-label="Example uses">
        {examples.map((example) => <article className="fify-launch__card" key={example.label}><span>{example.label}</span><h2>{example.title}</h2><p>{example.body}</p><q className="fify-launch__prompt">{example.prompt}</q></article>)}
      </section>
      <section className="fify-launch__trust" id="trust">
        <h2>The answer stays authoritative.</h2>
        <ul><li>Uses the answer and sources already grounded by ChatGPT.</li><li>Renders only validated, non-executable interface components.</li><li>Falls back to the complete plain-language answer if a view cannot render.</li><li>No end-user API key or Fify account required.</li></ul>
      </section>
    </div>
    <footer className="fify-launch__footer"><span>© 2026 Fify Contributors</span><nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></nav></footer>
  </main>;
}
