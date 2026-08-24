# @fify/evals

Provider-independent evaluation for Fify applications.

- `runPlanEvalSuite` checks semantic plan selection, forbidden components,
  stable IDs, validation, and domain assertions.
- `runComprehensionBenchmark` compares ordinary text and Fify artifacts on
  fact coverage, relationships, primary salience, content budgets, disclosure,
  grounding, redundancy, and scannability. It separates semantic diagnostics
  from browser-evidenced release results and applies hard eligibility gates.
  Browser captures include axe, runtime, network, viewport, screenshot, and
  live-control evidence.
- `comprehensionBenchmarkCasesV1` provides eight fixed-source, cross-domain
  benchmark cases.

The comprehension layer intentionally avoids expecting particular UI
components. Its semantic tier evaluates provider-independent content outcomes;
its release tier requires browser-origin evidence of what was actually visible
and interactive. See
`docs/comprehension-benchmark.md` for the scoring contract and live runner.
