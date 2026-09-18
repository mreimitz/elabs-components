/**
 * The settings tab's four sections (RM-095): workspace, members, notifications, API keys and
 * danger zone. Members reuse `company.ts`' `OWNERS` verbatim — the same nine names the
 * data-app tab's "Owner" column and `churn.ts`' movers list already show.
 */
import { COMPANY_FULL_NAME, COMPANY_NAME, OWNERS, type Owner } from "./company";

export type MemberRole = "owner" | "admin" | "member" | "viewer";
export type MemberStatus = "active" | "invited";

export interface SettingsMember {
  name: Owner;
  email: string;
  role: MemberRole;
  status: MemberStatus;
}

function emailFor(name: string): string {
  const [first, last] = name.toLowerCase().split(" ");
  return `${first}.${last}@ashgrove.example`;
}

/** The nine account owners from `orders.ts`, plus their workspace role. */
export const SETTINGS_MEMBERS: SettingsMember[] = OWNERS.map((name, i) => ({
  name,
  email: emailFor(name),
  role: i === 0 ? "owner" : i < 3 ? "admin" : "member",
  status: "active",
}));

export interface SettingsWorkspace {
  name: string;
  legalName: string;
  plan: "starter" | "growth" | "enterprise";
  timezone: string;
}

export const SETTINGS_WORKSPACE: SettingsWorkspace = {
  name: COMPANY_NAME,
  legalName: COMPANY_FULL_NAME,
  plan: "enterprise",
  timezone: "Europe/Amsterdam",
};

export interface SettingsNotification {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export const SETTINGS_NOTIFICATIONS: SettingsNotification[] = [
  {
    id: "weekly-digest",
    label: "Weekly KPI digest",
    description: "A summary of the ARR, churn and backlog series every Monday morning.",
    enabled: true,
  },
  {
    id: "renewal-risk",
    label: "Renewal risk alerts",
    description: "Notify the account owner when a customer's MRR drops for two months running.",
    enabled: true,
  },
  {
    id: "process-anomaly",
    label: "Process anomalies",
    description: "Flag order-to-cash cases that fall into the manual-review variant.",
    enabled: false,
  },
];

export interface SettingsApiKey {
  id: string;
  label: string;
  /** Always pre-masked — no real secret ever lives in a fixture. */
  maskedValue: string;
  createdBy: Owner;
  created: string;
}

export const SETTINGS_API_KEYS: SettingsApiKey[] = [
  {
    id: "key-live",
    label: "Production",
    maskedValue: "ag_live_••••••••••••wq4f",
    createdBy: OWNERS[0]!,
    created: "2026-04-02",
  },
  {
    id: "key-staging",
    label: "Staging",
    maskedValue: "ag_test_••••••••••••2m9k",
    createdBy: OWNERS[2]!,
    created: "2026-06-18",
  },
];

export const SETTINGS_DANGER_ZONE = {
  transferOwnershipLabel: "Transfer workspace ownership",
  deleteWorkspaceLabel: `Delete ${COMPANY_NAME}'s workspace`,
  deleteWorkspaceDescription:
    "Permanently deletes every order, KPI series and process log in this workspace. This cannot be undone.",
};
