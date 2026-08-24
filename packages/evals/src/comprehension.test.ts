import { describe, expect, it } from "vitest";
import {
  compareComprehensionArtifacts,
  evaluateComprehensionArtifact,
  runComprehensionBenchmark,
  textComprehensionArtifact,
  type ComprehensionArtifact,
  type ComprehensionBenchmarkCase,
} from "./comprehension.js";
import { comprehensionBenchmarkCasesV1 } from "./comprehension-cases.js";

const benchmarkCase: ComprehensionBenchmarkCase = {
  id: "incident",
  title: "Incident",
  attentionMode: "glance",
  prompt: "What happened and what should I do?",
  sourceContent:
    "Checkout recovered at 14:27 after rollback. Verify queued orders exactly once. Mobile was affected.",
  userTask: "Act quickly",
  wordBudget: 30,
  essentialFacts: [
    {
      id: "status",
      description: "Checkout recovered at 14:27",
      termGroups: [["checkout"], ["recovered"], ["14:27"]],
    },
    {
      id: "action",
      description: "Verify queued orders exactly once",
      termGroups: [["queued orders"], ["exactly once"]],
    },
  ],
  primaryFactIds: ["status", "action"],
  requiredRelationships: [
    {
      id: "recovery-time",
      description: "Recovery remains paired with its time",
      leftTerms: ["recovered"],
      rightTerms: ["14:27"],
      maxDistanceWords: 8,
    },
  ],
  deferrableFacts: [
    {
      id: "platform",
      description: "Mobile was affected",
      termGroups: [["mobile"], ["affected"]],
    },
  ],
  forbiddenClaims: [
    {
      id: "database",
      description: "No database outage is stated",
      termGroups: [["database outage"]],
    },
  ],
};

describe("comprehension benchmark", () => {
  it("scores content outcomes rather than component names", () => {
    const artifact: ComprehensionArtifact = {
      format: "ui",
      visibleText:
        "Checkout recovered at 14:27. Next: verify queued orders exactly once.",
      primaryText:
        "Checkout recovered at 14:27. Next: verify queued orders exactly once.",
      deferredText: "Platform detail: mobile was affected.",
      groups: [
        {
          label: "Status and action",
          text: "Checkout recovered at 14:27. Verify queued orders exactly once.",
          role: "primary",
        },
        {
          label: "Platform detail",
          text: "Mobile was affected.",
          role: "deferred",
        },
      ],
      render: {
        captureVersion: "1",
        captureSource: "browser",
        aboveFoldText:
          "Checkout recovered at 14:27. Verify queued orders exactly once.",
        viewportWidth: 1280,
        viewportHeight: 800,
        scrollHeight: 960,
        accessibilityViolations: 0,
        interactiveElements: 0,
        deadInteractiveElements: 0,
        runtimeErrors: 0,
        consoleErrors: 0,
        failedRequests: 0,
        interactionChecks: [],
        screenshotPath: "artifacts/incident.png",
      },
    };

    const result = evaluateComprehensionArtifact(benchmarkCase, artifact);

    expect(result.metrics).toMatchObject({
      score: 100,
      essentialCoverage: 1,
      visibleCoverage: 1,
      primarySalience: 1,
      progressiveDisclosure: 1,
      primaryAboveFold: true,
      scrollScreens: 1.2,
    });
    expect(result.failures).toEqual([]);
  });

  it("reports missing facts, overlong copy, and known unsupported claims", () => {
    const result = evaluateComprehensionArtifact(benchmarkCase, {
      format: "text",
      visibleText:
        "This database outage requires a long investigation with many preliminary observations that do not identify the checkout status, recovery time, or the concrete order replay action requested by the incident commander.",
      primaryText: "This database outage requires a long investigation.",
    });

    expect(result.metrics.score).toBeLessThan(50);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Missing essential fact: status"),
        expect.stringContaining("Missing essential fact: action"),
        expect.stringContaining("Matched forbidden claim: database"),
      ]),
    );
  });

  it("compares an ordinary text answer with a progressively disclosed UI", () => {
    const baseline = textComprehensionArtifact(
      "Checkout recovered at 14:27 after a lengthy operational sequence. Mobile was affected. The incident involved several teams and generated a large amount of discussion about possible follow-up work. Verify queued orders exactly once. Additional context can be reviewed later by the incident commander and engineering team.",
    );
    const fify: ComprehensionArtifact = {
      format: "ui",
      visibleText:
        "Checkout recovered at 14:27. Verify queued orders exactly once.",
      primaryText:
        "Checkout recovered at 14:27. Verify queued orders exactly once.",
      deferredText: "Mobile was affected.",
    };

    const result = compareComprehensionArtifacts(
      benchmarkCase,
      baseline,
      fify,
    );

    expect(result.winner).toBe("fify");
    expect(result.scoreDelta).toBeGreaterThanOrEqual(5);
    expect(result.fify.metrics.visibleWords).toBeLessThan(
      result.baseline.metrics.visibleWords,
    );
  });

  it("aggregates paired generators into a benchmark report", async () => {
    const report = await runComprehensionBenchmark({
      cases: [benchmarkCase],
      generateBaseline: async () =>
        textComprehensionArtifact(
          "Checkout recovered at 14:27. Mobile was affected. Verify queued orders exactly once, after reviewing this additional verbose incident context that is not needed for the immediate decision.",
        ),
      generateFify: async () => ({
        format: "ui",
        visibleText:
          "Checkout recovered at 14:27. Verify queued orders exactly once.",
        primaryText:
          "Checkout recovered at 14:27. Verify queued orders exactly once.",
        deferredText: "Mobile was affected.",
      }),
    });

    expect(report).toMatchObject({
      version: "1.2",
      semanticPassed: true,
      releasePassed: false,
      passed: false,
      evidenceLevel: "semantic",
      summary: { totalCases: 1, eligibleCases: 1, fifyWins: 1 },
    });
  });

  it("does not let a Markdown heading erase the substantive primary block", () => {
    const artifact = textComprehensionArtifact(
      "# Incident status\n\nCheckout recovered at 14:27. Verify queued orders exactly once.",
    );

    expect(artifact.primaryText).toContain("Checkout recovered");
    expect(
      evaluateComprehensionArtifact(benchmarkCase, artifact).metrics,
    ).toMatchObject({ primarySalience: 1 });
  });

  it("uses token boundaries and negation-aware forbidden-claim checks", () => {
    const numericCase: ComprehensionBenchmarkCase = {
      id: "numeric-boundary",
      title: "Numeric boundary",
      attentionMode: "glance",
      prompt: "Report the value",
      sourceContent: "The value is 3.",
      userTask: "Read the value",
      essentialFacts: [
        { id: "value", description: "Value is 3", termGroups: [["3"]] },
      ],
      primaryFactIds: ["value"],
    };
    expect(
      evaluateComprehensionArtifact(numericCase, {
        format: "text",
        visibleText: "The value is 34%.",
        primaryText: "The value is 34%.",
      }).metrics.essentialCoverage,
    ).toBe(0);

    const correct =
      "Checkout recovered at 14:27. Failed payments peaked at 38%. Checkout errors began after release 2026.08.24-3. Verify queued orders exactly once.";
    const negated = evaluateComprehensionArtifact(
      comprehensionBenchmarkCasesV1[0],
      {
        format: "text",
        visibleText: `${correct} This was not a database outage.`,
        primaryText: correct,
      },
    );
    const asserted = evaluateComprehensionArtifact(
      comprehensionBenchmarkCasesV1[0],
      {
        format: "text",
        visibleText: `${correct} This was a database outage.`,
        primaryText: correct,
      },
    );
    expect(negated.metrics.grounding).toBe(1);
    expect(asserted.metrics.grounding).toBe(0);
    expect(asserted.hardFailures).toEqual([
      expect.stringContaining("Matched forbidden claim"),
    ]);
  });

  it("only awards progressive disclosure when deferred content exists", () => {
    const primary =
      "Checkout recovered at 14:27. Verify queued orders exactly once.";
    const omitted = evaluateComprehensionArtifact(benchmarkCase, {
      format: "ui",
      visibleText: primary,
      primaryText: primary,
    });
    const visible = evaluateComprehensionArtifact(benchmarkCase, {
      format: "ui",
      visibleText: `${primary} Mobile was affected.`,
      primaryText: primary,
    });
    const deferred = evaluateComprehensionArtifact(benchmarkCase, {
      format: "ui",
      visibleText: primary,
      primaryText: primary,
      deferredText: "Mobile was affected.",
    });
    expect(omitted.metrics.progressiveDisclosure).toBe(0);
    expect(visible.metrics.progressiveDisclosure).toBe(0);
    expect(deferred.metrics.progressiveDisclosure).toBe(1);
  });

  it("makes unsafe recovery guidance ineligible even when other facts are present", () => {
    const recoveryCase = comprehensionBenchmarkCasesV1.find(
      ({ id }) => id === "ordered-account-recovery",
    );
    expect(recoveryCase).toBeDefined();
    const unsafe = evaluateComprehensionArtifact(recoveryCase!, {
      format: "ui",
      visibleText:
        "First verify two identity factors before access changes. If either fails, stop and escalate to Trust & Safety. After verification, revoke active sessions and issue a recovery link valid for 15 minutes. Confirm the user can sign in and record the case ID. Ask for the user's existing password.",
      primaryText:
        "First verify two identity factors. If either fails, stop and escalate to Trust & Safety.",
      groups: [{ label: "Recovery", text: "Procedure", role: "primary" }],
    });

    expect(unsafe.hardFailures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("never-request-existing-password"),
        expect.stringContaining("request-existing-password"),
      ]),
    );
  });

  it("requires clean rendered evidence and the complete case set for release pass", async () => {
    const baselineText =
      "Checkout recovered at 14:27. Mobile was affected. Verify queued orders exactly once, after reviewing this extra operational context that is not needed for the immediate decision.";
    const fifyText =
      "Checkout recovered at 14:27. Verify queued orders exactly once.";
    const render = {
      captureVersion: "1" as const,
      captureSource: "browser" as const,
      aboveFoldText: fifyText,
      viewportWidth: 1280,
      viewportHeight: 800,
      scrollHeight: 900,
      accessibilityViolations: 0,
      interactiveElements: 0,
      deadInteractiveElements: 0,
      runtimeErrors: 0,
      consoleErrors: 0,
      failedRequests: 0,
      interactionChecks: [],
      screenshotPath: "artifacts/incident.png",
    };
    const report = await runComprehensionBenchmark({
      cases: [benchmarkCase],
      releaseCaseIds: [benchmarkCase.id],
      generateBaseline: async () => ({
        ...textComprehensionArtifact(baselineText),
        render,
      }),
      generateFify: async () => ({
        format: "ui",
        visibleText: fifyText,
        primaryText: fifyText,
        deferredText: "Mobile was affected.",
        groups: [{ label: "Status", text: fifyText, role: "primary" }],
        render,
      }),
    });

    expect(report).toMatchObject({
      semanticPassed: true,
      releasePassed: true,
      passed: true,
      completeCaseSet: true,
      evidenceLevel: "rendered",
    });

    const brokenRender = evaluateComprehensionArtifact(benchmarkCase, {
      format: "ui",
      visibleText: fifyText,
      primaryText: fifyText,
      deferredText: "Mobile was affected.",
      groups: [{ label: "Status", text: fifyText, role: "primary" }],
      render: {
        ...render,
        aboveFoldText: "",
        scrollHeight: 8_000,
        accessibilityViolations: 2,
        interactiveElements: 1,
        deadInteractiveElements: 1,
        runtimeErrors: 1,
        consoleErrors: 1,
        failedRequests: 1,
        interactionChecks: [
          {
            id: "dead-button",
            role: "button",
            name: "Dead button",
            action: "click" as const,
            passed: false,
            evidence: "No observable state change",
          },
        ],
      },
    });
    expect(brokenRender.hardFailures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("accessibility violation"),
        expect.stringContaining("dead interactive element"),
        expect.stringContaining("runtime error"),
        expect.stringContaining("console error"),
        expect.stringContaining("failed request"),
        expect.stringContaining("not above the fold"),
        expect.stringContaining("scroll budget"),
      ]),
    );

    const inconsistentCapture = evaluateComprehensionArtifact(benchmarkCase, {
      format: "ui",
      visibleText: fifyText,
      primaryText: fifyText,
      deferredText: "Mobile was affected.",
      render: { ...render, interactiveElements: 1 },
    });
    expect(inconsistentCapture.metrics.renderEvidence).toBe(false);
    expect(inconsistentCapture.hardFailures).toContain(
      "Rendered evidence is incomplete or internally inconsistent",
    );
  });
});
