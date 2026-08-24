# ADR 0008: Product-owned visual constitution

- Status: accepted
- Date: 2026-08-23
- Supersedes: the model-authored visual direction in ADR 0006 and ADR 0007

## Context

UI language v3 separated executable code from model output but still allowed the model to choose palette, personality, density, visual variants, tone, span, and decorative icons. This produced schema-valid interfaces with recurring generative-UI mannerisms: unnecessary hero surfaces, card grids, badges, ornamental labels, gradients, and repeated section framing. Prompt tuning reduced individual failures but left visual authority at the wrong boundary.

## Decision

UI language v4 assigns meaning and interaction to the model and visual expression to the product. Model-authored nodes declare semantic importance (`primary`, `supporting`, or `quiet`), relationship (`standalone`, `grouped`, or `continuation`), media role, information content, and constrained actions. Presentation tokens remain runtime-only and are not present in the Structured Output schema.

The trusted renderer receives the full representation plan and adds response-scale, topology, and blueprint context to the surface. Components render through one Fify visual constitution: typography before containment, neutral foundations, a single accent, restrained borders, limited primary emphasis, subject-specific headings, and controls only when they have real behavior.

The routing boundary repairs missing blueprint-required roles deterministically. The composition boundary strips generic meta headings, converts atomic heroes to text, and normalizes exactly one primary content element. A deterministic taste evaluator reports container-budget, heading, emphasis, and interaction-restraint violations for regression tests and prompt-matrix review.

## Consequences

Different jobs retain different information architecture while looking like one coherent product. The model has less ability to create arbitrary art direction, but open composition remains available through semantic layout and component selection. New visual treatments become reviewed renderer changes rather than prompt changes. Visual quality can be improved without retraining or migrating the model contract.
