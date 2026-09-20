// registry: a2ui-parts — copied 2026-09-19
/**
 * The conversations the A2UI assistant template can hold. Each one is what a real integration
 * has: the person's ask, the agent's first surface, and — per host action — what the APP does
 * (a line it says back, and optionally the agent's next surface).
 */
import type { A2uiSurfaceSpec } from "@elabs-ai/components-ai";
import {
  GUARDRAIL_INVALID,
  GUARDRAIL_REPAIRED,
  INCIDENT_INTAKE,
  INCIDENT_OPENED,
  REFUND_APPROVAL,
  REFUND_APPROVED,
  REFUND_CREDIT,
  REFUND_DECLINED,
  REGION_DRILL,
  REVENUE_INSIGHT,
  ROLLOUT_HELD,
  ROLLOUT_PLAN,
} from "../a2ui-parts/surfaces";

export interface ScenarioReply {
  /** What the person's click means, in the conversation ("Approve the refund"). */
  youSaid: string;
  /** The agent's one line before its next surface. */
  agentSays: string;
  /** The next surface. Omit it for an action the host handles silently (a toast, a route change). */
  surface?: A2uiSurfaceSpec;
}

export interface Scenario {
  id: string;
  /** Navigation label. */
  label: string;
  /** The agent that answers. */
  agent: string;
  /** What the person asked. */
  prompt: string;
  /** The agent's one line before the first surface. */
  intro: string;
  surface: A2uiSurfaceSpec;
  /** Host action name → what happens. Actions not listed are logged and nothing else. */
  replies: Record<string, ScenarioReply>;
  /** Which A2UI capability this conversation is there to show. */
  shows: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "refund",
    label: "Refund R-2207",
    agent: "Support agent",
    prompt: "Dana Whitfield wants a refund for the Trail 40 backpack. Can I approve it?",
    intro:
      "It is four days outside the window, but policy covers a manufacturing defect. Here is everything you need to decide.",
    surface: REFUND_APPROVAL,
    shows: "A decision the agent prepares and the app executes",
    replies: {
      "approve-refund": {
        youSaid: "Approve the refund",
        agentSays: "Done. The refund is out and the defect is logged against the supplier batch.",
        surface: REFUND_APPROVED,
      },
      "decline-refund": {
        youSaid: "Decline",
        agentSays: "Declined. One thing you should know before you move on:",
        surface: REFUND_DECLINED,
      },
      "offer-credit": {
        youSaid: "Offer store credit instead",
        agentSays: "Offer sent. I will bring it back to you if she says no.",
        surface: REFUND_CREDIT,
      },
      "undo-decision": {
        youSaid: "Undo that",
        agentSays: "Reverted. The request is open again.",
        surface: REFUND_APPROVAL,
      },
    },
  },
  {
    id: "revenue",
    label: "Q3 revenue by region",
    agent: "Analytics agent",
    prompt: "How did Q3 revenue do by region?",
    intro: "Up 6 % overall, but the regions tell two different stories.",
    surface: REVENUE_INSIGHT,
    shows: "Charts from the charts half of the catalog, and a drill-down on click",
    replies: {
      "drill-region": {
        youSaid: "Open the UK & Ireland accounts",
        agentSays: "Six accounts explain the whole decline. Three of them carry two thirds of it.",
        surface: REGION_DRILL,
      },
      "back-to-overview": {
        youSaid: "Back to the overview",
        agentSays: "Here is the regional picture again.",
        surface: REVENUE_INSIGHT,
      },
      "share-answer": {
        youSaid: "Send it to the revenue channel",
        agentSays: "Posted to #revenue with the four sources attached.",
      },
      "schedule-report": {
        youSaid: "Save it as a weekly report",
        agentSays: "Saved. You will get this every Monday at 08:00.",
      },
      "draft-save-plan": {
        youSaid: "Draft a save plan for the top three",
        agentSays:
          "Drafting one plan per account. I will ask you to approve each before anything is sent.",
      },
    },
  },
  {
    id: "incident",
    label: "Alert #88213",
    agent: "Incident agent",
    prompt: "Checkout is throwing 502s. Open an incident.",
    intro: "I filled the form from the alert. Correct what is wrong and send it.",
    surface: INCIDENT_INTAKE,
    shows: "Form controls whose changes reach the host as named actions",
    replies: {
      "open-incident": {
        youSaid: "Open the incident",
        agentSays:
          "INC-4512 is open and the on-call has acknowledged. One decision is left to you.",
        surface: INCIDENT_OPENED,
      },
      "discard-incident": {
        youSaid: "Discard the draft",
        agentSays: "Discarded. The alert stays open in the queue.",
      },
      "confirm-rollback": {
        youSaid: "Roll back now",
        agentSays: "Rolling payments-gateway back to v811. I will report when error rates settle.",
      },
      "hold-rollback": {
        youSaid: "Hold the rollback",
        agentSays:
          "Holding. I will ask again in ten minutes or when the failure share passes 50 %.",
      },
    },
  },
  {
    id: "rollout",
    label: "search-ranker v3",
    agent: "Release agent",
    prompt: "Can we take search-ranker v3 to 50 %?",
    intro: "I would not yet. Latency is fine, but one check failed and I know why.",
    surface: ROLLOUT_PLAN,
    shows: "Tabs, tables, bullet charts and sparklines in one streamed surface",
    replies: {
      "hold-rollout": {
        youSaid: "Hold and ship PR 9114 first",
        agentSays: "Held. The fix rides the 15:00 train and I re-run the canary checks after it.",
        surface: ROLLOUT_HELD,
      },
      "continue-rollout": {
        youSaid: "Continue to 50 % anyway",
        agentSays:
          "Moving to 50 %. I am watching zero-result searches and will stop at 6 % without asking.",
      },
      rollback: {
        youSaid: "Roll back to v2",
        agentSays: "Rolling back. Traffic returns to v2 within about two minutes.",
      },
    },
  },
  {
    id: "guardrail",
    label: "A surface that misbehaves",
    agent: "Marketing agent",
    prompt: "Make the upgrade offer really pop — brand red, and embed our tracking page.",
    intro: "Here is a first attempt.",
    surface: GUARDRAIL_INVALID,
    shows: "What the catalog refuses, and the repaired surface that follows",
    replies: {
      "request-repair": {
        youSaid: "Send the error list back to the agent",
        agentSays:
          "Understood: no custom styles, no frames, no handlers. The same offer, inside the catalog:",
        surface: GUARDRAIL_REPAIRED,
      },
      "claim-offer": {
        youSaid: "Claim the offer",
        agentSays: "Applied. Your annual plan renews at 20 % off.",
      },
      "dismiss-offer": {
        youSaid: "Not now",
        agentSays: "No problem. The offer stays until Friday.",
      },
    },
  },
];
