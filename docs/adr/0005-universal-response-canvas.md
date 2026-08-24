# ADR 0005: Use a universal information catalog as the default AI response medium

- Status: accepted
- Date: 2026-08-21

## Context

ADR 0004 established progressive UI as the response transport, but the first implementation embedded that behavior in the weather product contract. It proved incremental A2UI rendering without proving the actual product goal: an arbitrary prompt should produce a well-designed interface whose shape follows the answer.

A universal system still needs a trust boundary. Generating arbitrary HTML or React would make visual quality, accessibility, security, portability, and incremental reconciliation model responsibilities. A single dashboard template would be safe but would not express materially different information shapes.

## Decision

Fify's default contract is a finite catalog of cross-domain information components plus a strict response recipe. The catalog covers conclusion, synthesis, quantities, findings, process, chronology, comparison, action, quotation, structured attributes, progress, and resources. The model selects and fills those semantics; the application renders them.

The default browser and `/api/ui` route use this contract. Trusted live data enters through host-owned evidence adapters rather than domain-specific framework packages.

The full recipe has cross-section rules in addition to JSON Schema:

- two to six sections;
- globally unique section and item IDs;
- at most one hero, only first;
- at least one non-hero content section;
- minimum item counts for item-driven components;
- mobile copy limits and two to four follow-up prompts.

Structured Output deltas are never shown as prose. Complete `screen` and section values are extracted, validated, compiled, and streamed into one A2UI surface. The complete recipe is the final commit boundary.

## Consequences

One runtime can represent unrelated prompt families without executing model-authored UI code. Product designers retain control of every rendered state while the model controls information architecture within the catalog.

The catalog is intentionally not universal in the theoretical sense. Specialized facts, visualizations, interactions, and actions still require domain packages. Cross-domain evals now guard against regressing into a weather template or a one-layout dashboard.
