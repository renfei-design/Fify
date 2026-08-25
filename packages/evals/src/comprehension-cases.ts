import type { ComprehensionBenchmarkCase } from "./comprehension.js";

/**
 * Small, fixed-source benchmark for v1. It deliberately spans different user
 * jobs while keeping every correct answer independently auditable.
 */
export const comprehensionBenchmarkCasesV1 = [
  {
    id: "incident-five-second-status",
    title: "Incident status at a glance",
    attentionMode: "glance",
    prompt:
      "Give the incident commander the current status and next action in five seconds.",
    userTask: "Understand current impact and act without reading a narrative.",
    sourceContent:
      "Checkout errors began at 14:07 UTC immediately after release 2026.08.24-3. Failed payments peaked at 38%, versus a normal 2%. Rollback began at 14:19. Error rates returned to normal by 14:27. Mobile web and desktop web were affected; subscriptions were not. Before reopening deployments, verify that queued orders replayed exactly once.",
    essentialFacts: [
      {
        id: "recovered",
        description: "Error rates returned to normal at 14:27",
        termGroups: [["returned to normal", "recovered"], ["14:27"]],
      },
      {
        id: "peak-impact",
        description: "Failed payments peaked at 38%",
        termGroups: [["failed payments", "payment failures"], ["38%"]],
      },
      {
        id: "next-action",
        description: "Verify queued orders replayed exactly once",
        termGroups: [["queued orders", "order queue"], ["exactly once"]],
      },
      {
        id: "release-trigger",
        description: "The errors followed release 2026.08.24-3",
        termGroups: [["release"], ["2026.08.24-3"]],
      },
    ],
    primaryFactIds: ["recovered", "next-action"],
    requiredRelationships: [
      {
        id: "release-preceded-errors",
        description:
          "The release and beginning of checkout errors stay connected",
        leftTerms: ["2026.08.24-3"],
        rightTerms: ["checkout errors", "errors began"],
        maxDistanceWords: 28,
      },
    ],
    deferrableFacts: [
      {
        id: "affected-clients",
        description: "Mobile and desktop web were affected",
        termGroups: [["mobile web"], ["desktop web"]],
      },
    ],
    forbiddenClaims: [
      {
        id: "database-outage",
        description: "The source never identifies a database outage",
        termGroups: [["database outage"]],
      },
    ],
  },
  {
    id: "meeting-decisions-actions",
    title: "Meeting decisions and ownership",
    attentionMode: "work",
    prompt:
      "Turn these notes into decisions, owners, deadlines, and open risks.",
    userTask:
      "Leave the meeting knowing what changed and who must do what next.",
    sourceContent:
      "Project Aurora launch moved from September 11 to September 18 because legal review is incomplete. The team kept the September 10 beta invite date. Maya owns final legal copy by September 12. Chen owns the migration rehearsal by September 13. Pricing-page localization is still unassigned and could block launch. The next check-in is September 14 at 10:00.",
    essentialFacts: [
      {
        id: "launch-moved",
        description:
          "Launch moved to September 18 because legal review is incomplete",
        termGroups: [["September 18", "Sep 18"], ["legal review"]],
      },
      {
        id: "maya-action",
        description: "Maya owns final legal copy by September 12",
        termGroups: [["Maya"], ["legal copy"], ["September 12", "Sep 12"]],
      },
      {
        id: "chen-action",
        description: "Chen owns migration rehearsal by September 13",
        termGroups: [
          ["Chen"],
          ["migration rehearsal"],
          ["September 13", "Sep 13"],
        ],
      },
      {
        id: "unowned-risk",
        description:
          "Pricing localization remains unassigned and may block launch",
        termGroups: [
          ["pricing", "pricing-page"],
          ["unassigned", "no owner"],
          ["block"],
        ],
      },
    ],
    primaryFactIds: ["launch-moved", "unowned-risk"],
    requiredRelationships: [
      {
        id: "maya-deadline",
        description: "Maya remains paired with the September 12 deadline",
        leftTerms: ["Maya"],
        rightTerms: ["September 12", "Sep 12"],
        maxDistanceWords: 18,
      },
      {
        id: "chen-deadline",
        description: "Chen remains paired with the September 13 deadline",
        leftTerms: ["Chen"],
        rightTerms: ["September 13", "Sep 13"],
        maxDistanceWords: 18,
      },
    ],
    deferrableFacts: [
      {
        id: "check-in",
        description: "Next check-in is September 14 at 10:00",
        termGroups: [["September 14", "Sep 14"], ["10:00"]],
      },
    ],
  },
  {
    id: "terminal-failure-diagnosis",
    title: "Terminal failure diagnosis",
    attentionMode: "work",
    prompt: "Diagnose the failure and show the safest next step.",
    userTask:
      "Find the likely cause and fix without scanning the full test log.",
    sourceContent:
      "Test run: 147 passed, 1 failed. Failure: packages/cache/src/eviction.test.ts, 'stops cleanup after abort'. Expected active timers: 3; received: 4. It reproduces on Node 22 but not Node 20. The abort path removes the listener but never calls clearInterval(cleanupTimer). The timer is created in startCleanup() at eviction.ts:88. No production data was modified.",
    essentialFacts: [
      {
        id: "single-failure",
        description: "One cache eviction test failed while 147 passed",
        termGroups: [["147"], ["1 failed", "one failed"]],
      },
      {
        id: "root-cause",
        description: "The abort path does not clear the cleanup interval",
        termGroups: [["abort path"], ["clearInterval", "clear interval"]],
      },
      {
        id: "safe-fix",
        description: "Clear cleanupTimer during abort handling",
        termGroups: [
          ["cleanupTimer", "cleanup timer"],
          ["clearInterval", "clear interval"],
        ],
      },
      {
        id: "runtime-scope",
        description: "The issue reproduces on Node 22, not Node 20",
        termGroups: [["Node 22"], ["Node 20"]],
      },
    ],
    primaryFactIds: ["root-cause", "safe-fix"],
    requiredRelationships: [
      {
        id: "abort-leaks-timer",
        description: "The abort path is connected to the uncleared interval",
        leftTerms: ["abort path", "abort"],
        rightTerms: ["clearInterval", "clear interval"],
        maxDistanceWords: 25,
      },
    ],
    deferrableFacts: [
      {
        id: "source-location",
        description: "The timer is created at eviction.ts:88",
        termGroups: [["eviction.ts:88", "eviction.ts", "line 88"]],
      },
    ],
    forbiddenClaims: [
      {
        id: "data-loss",
        description: "The source does not report data loss",
        termGroups: [["data loss"]],
      },
    ],
  },
  {
    id: "constraint-heavy-tool-choice",
    title: "Constraint-heavy product decision",
    attentionMode: "read",
    prompt:
      "Choose the tool that meets our requirements, or say if neither does.",
    userTask:
      "Reach a defensible purchase decision from interacting constraints.",
    sourceContent:
      "The team has 18 people and a hard budget of $600 per month. SSO and API export are mandatory. Atlas Standard is $24 per user per month and has API export but no SSO. Atlas Business adds SSO at $39 per user per month. Beacon is $28 per user per month and includes SSO, but it exports CSV only and has no API. Annual discounts are unknown.",
    essentialFacts: [
      {
        id: "neither-qualifies",
        description:
          "Neither available option satisfies every mandatory constraint",
        termGroups: [["neither", "no option"], ["SSO"], ["API"]],
      },
      {
        id: "atlas-business-over-budget",
        description:
          "Atlas Business costs $702 monthly for 18 people, over budget",
        termGroups: [["Atlas Business"], ["$702", "702"], ["budget"]],
      },
      {
        id: "atlas-standard-gap",
        description: "Atlas Standard lacks SSO",
        termGroups: [
          ["Atlas Standard"],
          ["no SSO", "lacks SSO", "without SSO"],
        ],
      },
      {
        id: "beacon-gap",
        description: "Beacon lacks API export",
        termGroups: [
          ["Beacon"],
          ["no API", "lacks API", "without API", "CSV only"],
        ],
      },
    ],
    primaryFactIds: ["neither-qualifies"],
    requiredRelationships: [
      {
        id: "atlas-cost-calculation",
        description:
          "Atlas Business's total cost stays connected to the 18-person team",
        leftTerms: ["Atlas Business"],
        rightTerms: ["$702", "702"],
        maxDistanceWords: 25,
      },
    ],
    deferrableFacts: [
      {
        id: "discount-unknown",
        description: "Annual discounts are unknown",
        termGroups: [["annual discounts"], ["unknown"]],
      },
    ],
    forbiddenClaims: [
      {
        id: "invented-atlas-enterprise",
        description: "The source does not contain an Atlas Enterprise plan",
        termGroups: [["Atlas Enterprise"]],
      },
    ],
  },
  {
    id: "research-evidence-calibration",
    title: "Research evidence calibration",
    attentionMode: "read",
    prompt: "Summarize what this study supports and what it does not prove.",
    userTask:
      "Understand the result, uncertainty, and limitations without overclaiming.",
    sourceContent:
      "A randomized pilot enrolled 120 adults for eight weeks. The intervention group improved delayed recall by 12 percentage points versus control (95% confidence interval: 3 to 21 points). Completion time did not differ significantly. Attrition was 34%, and participants could not be blinded. The study was not powered to measure long-term outcomes.",
    essentialFacts: [
      {
        id: "recall-improved",
        description: "Delayed recall improved by 12 percentage points",
        termGroups: [
          ["delayed recall", "recall"],
          ["12 percentage points", "12 points", "12 pp"],
        ],
      },
      {
        id: "uncertainty",
        description: "The 95% confidence interval was 3 to 21 points",
        termGroups: [["95%"], ["3"], ["21"]],
      },
      {
        id: "attrition",
        description: "Attrition was 34%",
        termGroups: [["attrition"], ["34%"]],
      },
      {
        id: "long-term-limit",
        description: "The study was not powered for long-term outcomes",
        termGroups: [["not powered", "underpowered"], ["long-term"]],
      },
    ],
    primaryFactIds: ["recall-improved", "long-term-limit"],
    requiredRelationships: [
      {
        id: "effect-with-interval",
        description:
          "The recall effect remains paired with its uncertainty interval",
        leftTerms: ["12 percentage points", "12 points", "12 pp"],
        rightTerms: ["95%", "confidence interval"],
        maxDistanceWords: 35,
      },
    ],
    deferrableFacts: [
      {
        id: "completion-time",
        description: "Completion time did not differ significantly",
        termGroups: [
          ["completion time"],
          ["did not differ", "no significant difference"],
        ],
      },
    ],
    forbiddenClaims: [
      {
        id: "zero-attrition",
        description: "The source reports 34% attrition, not zero attrition",
        termGroups: [["zero attrition", "0% attrition"]],
      },
    ],
  },
  {
    id: "business-metric-briefing",
    title: "Business metric briefing",
    attentionMode: "glance",
    prompt: "Give the leadership team the headline and the risk behind it.",
    userTask:
      "See whether growth is healthy enough to celebrate without qualification.",
    sourceContent:
      "Q2 revenue was $8.4 million, up 18% year over year. Gross margin fell from 61% to 54%. Enterprise revenue grew 70%. Monthly SMB churn increased from 6.2% to 9.1%. At the current burn, cash runway is 11 months. No guidance was provided for Q3.",
    essentialFacts: [
      {
        id: "revenue-growth",
        description: "Revenue reached $8.4M and grew 18%",
        termGroups: [["$8.4 million", "$8.4M", "8.4 million"], ["18%"]],
      },
      {
        id: "margin-decline",
        description: "Gross margin fell from 61% to 54%",
        termGroups: [["gross margin"], ["61%"], ["54%"]],
      },
      {
        id: "churn-rise",
        description: "SMB churn rose from 6.2% to 9.1%",
        termGroups: [["SMB churn", "churn"], ["6.2%"], ["9.1%"]],
      },
      {
        id: "runway",
        description: "Cash runway is 11 months",
        termGroups: [["runway"], ["11 months"]],
      },
    ],
    primaryFactIds: ["revenue-growth", "margin-decline"],
    requiredRelationships: [
      {
        id: "growth-versus-margin",
        description:
          "Revenue growth is presented together with margin compression",
        leftTerms: ["18%"],
        rightTerms: ["gross margin", "54%"],
        maxDistanceWords: 35,
      },
    ],
    deferrableFacts: [
      {
        id: "q3-guidance",
        description: "No Q3 guidance was provided",
        termGroups: [["Q3"], ["no guidance", "guidance was not provided"]],
      },
    ],
  },
  {
    id: "executive-operating-briefing",
    title: "Executive operating briefing",
    attentionMode: "glance",
    prompt:
      "Turn these operating results into an executive briefing with signals, the decision, risks, and next actions.",
    userTask:
      "Understand the operating signal, make the pending decision, and see ownership without reading a narrative.",
    sourceContent:
      "Revenue remains on plan. Enterprise implementation backlog is up 18%, and renewal exposure is concentrated in three strategic accounts. The proposed response is a 90-day partner-capacity plan owned by the COO. Leadership must approve or reject the plan by Friday. If approved, the COO will return next Tuesday with partner commitments and an account-level renewal mitigation review.",
    essentialFacts: [
      {
        id: "revenue-on-plan",
        description: "Revenue remains on plan",
        termGroups: [["revenue"], ["on plan"]],
      },
      {
        id: "backlog-rise",
        description: "Enterprise implementation backlog is up 18%",
        termGroups: [["implementation backlog", "backlog"], ["18%"]],
      },
      {
        id: "renewal-exposure",
        description: "Renewal exposure is concentrated in three accounts",
        termGroups: [
          ["renewal exposure", "renewal risk"],
          ["three strategic accounts", "3 strategic accounts"],
        ],
      },
      {
        id: "pending-decision",
        description: "Leadership must decide on the 90-day plan by Friday",
        termGroups: [
          ["approve", "reject", "decision", "decide"],
          ["90-day"],
          ["Friday"],
        ],
      },
      {
        id: "owner",
        description: "The COO owns the partner-capacity plan",
        termGroups: [["COO"], ["partner-capacity", "partner capacity"]],
      },
    ],
    primaryFactIds: ["backlog-rise", "renewal-exposure", "pending-decision"],
    requiredRelationships: [
      {
        id: "decision-deadline",
        description: "The 90-day plan decision remains paired with Friday",
        leftTerms: ["90-day"],
        rightTerms: ["Friday"],
        maxDistanceWords: 28,
      },
      {
        id: "plan-owner",
        description: "The partner-capacity plan remains paired with the COO",
        leftTerms: ["partner-capacity", "partner capacity"],
        rightTerms: ["COO"],
        maxDistanceWords: 24,
      },
    ],
    deferrableFacts: [
      {
        id: "follow-up",
        description:
          "The COO will return Tuesday with partner commitments and renewal mitigation",
        termGroups: [
          ["Tuesday"],
          ["partner commitments"],
          ["renewal mitigation", "account-level renewal"],
        ],
      },
    ],
    forbiddenClaims: [
      {
        id: "revenue-miss",
        description: "The source says revenue is on plan, not below plan",
        termGroups: [["revenue"], ["below plan", "missed plan"]],
      },
      {
        id: "company-wide-renewal-risk",
        description: "Renewal exposure is limited to three strategic accounts",
        termGroups: [["company-wide renewal", "all renewals"]],
      },
    ],
    wordBudget: 90,
  },
  {
    id: "two-day-constraint-plan",
    title: "Constraint-aware schedule",
    attentionMode: "explore",
    prompt:
      "Build a feasible two-day plan and make the timing conflicts obvious.",
    userTask: "Follow a schedule that respects opening hours and travel time.",
    sourceContent:
      "The visit is Monday and Tuesday. The Design Museum is closed Monday and open Tuesday 10:00-18:00; allow two hours. The Archive is open Monday only, 09:00-13:00; allow 90 minutes. Studio North offers a fixed tour Monday at 14:00 for one hour. Travel from the Archive to Studio North takes 35 minutes. Travel from Studio North to the hotel takes 20 minutes. Tuesday dinner is booked at 19:00, 25 minutes from the Design Museum.",
    essentialFacts: [
      {
        id: "archive-monday",
        description: "The Archive must be scheduled Monday before 13:00",
        termGroups: [["Archive"], ["Monday"], ["13:00", "1:00"]],
      },
      {
        id: "studio-monday",
        description: "Studio North is fixed at Monday 14:00",
        termGroups: [["Studio North"], ["Monday"], ["14:00", "2:00"]],
      },
      {
        id: "museum-tuesday",
        description:
          "The Design Museum belongs on Tuesday because it is closed Monday",
        termGroups: [["Design Museum"], ["Tuesday"], ["closed Monday"]],
      },
      {
        id: "dinner-buffer",
        description:
          "Tuesday plan preserves the 25-minute trip to the 19:00 dinner",
        termGroups: [
          ["dinner"],
          ["19:00", "7:00"],
          ["25 minutes", "25-minute"],
        ],
      },
    ],
    primaryFactIds: ["archive-monday", "museum-tuesday"],
    requiredRelationships: [
      {
        id: "archive-to-studio-travel",
        description:
          "Monday's Archive and Studio stops account for 35 minutes of travel",
        leftTerms: ["Archive"],
        rightTerms: ["35 minutes", "35-minute"],
        maxDistanceWords: 45,
      },
    ],
    deferrableFacts: [
      {
        id: "hotel-transfer",
        description: "Studio North to hotel takes 20 minutes",
        termGroups: [["hotel"], ["20 minutes", "20-minute"]],
      },
    ],
  },
  {
    id: "ordered-account-recovery",
    title: "Safety-critical procedure",
    attentionMode: "work",
    prompt:
      "Turn this policy into a clear recovery procedure for support agents.",
    userTask:
      "Complete account recovery in the required order without bypassing security.",
    sourceContent:
      "First verify two identity factors. If either factor fails, stop and escalate to Trust & Safety; do not reset access. After both factors pass, revoke active sessions, issue a one-time recovery link that expires in 15 minutes, and require a new password. Finally, confirm the user can sign in and record the case ID. Support agents must never ask for the user's existing password.",
    essentialFacts: [
      {
        id: "verify-first",
        description: "Verify two identity factors before changing access",
        termGroups: [["two", "2"], ["identity factors"], ["first", "before"]],
      },
      {
        id: "failed-factor-stop",
        description: "A failed factor requires stopping and escalating",
        termGroups: [
          ["fails", "failed"],
          ["stop"],
          ["escalate", "Trust & Safety"],
        ],
      },
      {
        id: "recovery-sequence",
        description:
          "After verification, revoke sessions and issue a 15-minute recovery link",
        termGroups: [
          ["revoke"],
          ["sessions"],
          ["recovery link"],
          ["15 minutes"],
        ],
      },
      {
        id: "confirm-and-record",
        description: "Confirm sign-in and record the case ID",
        termGroups: [["confirm"], ["sign in", "sign-in"], ["case ID"]],
      },
      {
        id: "never-request-existing-password",
        description: "Never ask for the user's existing password",
        termGroups: [
          ["never", "do not", "must not"],
          ["ask", "request"],
          ["existing password", "current password"],
        ],
      },
    ],
    primaryFactIds: ["verify-first", "failed-factor-stop"],
    requiredRelationships: [
      {
        id: "verification-before-reset",
        description: "Identity verification clearly precedes recovery access",
        leftTerms: ["identity factors", "verification"],
        rightTerms: ["recovery link", "reset access"],
        maxDistanceWords: 55,
      },
    ],
    deferrableFacts: [],
    forbiddenClaims: [
      {
        id: "email-current-password",
        description:
          "The source never permits sending a current password by email",
        termGroups: [
          ["email the current password", "send the current password by email"],
        ],
      },
      {
        id: "request-existing-password",
        description: "Support must not request the existing password",
        termGroups: [
          [
            "ask for the user's existing password",
            "ask for their existing password",
            "ask for existing password",
            "request the existing password",
            "request existing password",
          ],
        ],
      },
    ],
  },
] as const satisfies readonly ComprehensionBenchmarkCase[];
