/**
 * Demo content for the settings screen, keyed by `sectionKey(area, section)`.
 *
 * A copy-own block takes data IN and renders chrome OUT: every screen prop
 * defaults to the fixture here, so the block renders believably before you have
 * wired anything up, and swapping in your own data is one prop.
 */

/** The two control shapes this screen renders. */
export type SettingControl =
  /** A real `Switch`, labelled by the row's own label element. */
  | { kind: "switch"; on: boolean }
  /**
   * A settled value plus the control that changes it. The value is TEXT, not a
   * `<Select>`: a settings index shows what is configured and hands the detail
   * to a dedicated surface — inlining every editor here is what turns a
   * settings screen into a form nobody finishes.
   */
  | { kind: "value"; value: string; action: string };

export interface SettingRow {
  id: string;
  label: string;
  description: string;
  control: SettingControl;
  /**
   * Set on the rows a section counts in its `attention` total. The string is
   * the WORD half of the mark — the coloured dot beside it is the other half,
   * and colour alone would be a 1.4.1 failure (see .claude/rules/accessibility.md).
   */
  attention?: string;
}

export interface SettingGroup {
  id: string;
  title: string;
  description: string;
  rows: SettingRow[];
}

export const SETTINGS_GROUPS: Record<string, SettingGroup[]> = {
  "workspace/general": [
    {
      id: "identity",
      title: "Identity",
      description: "How this workspace is named everywhere it appears.",
      rows: [
        {
          id: "name",
          label: "Workspace name",
          description: "Shown in the switcher, in invitations and on exported reports.",
          control: { kind: "value", value: "Northwind Analytics", action: "Rename" },
        },
        {
          id: "slug",
          label: "Workspace URL",
          description: "The address people bookmark. Changing it breaks existing links.",
          control: { kind: "value", value: "northwind", action: "Change" },
        },
        {
          id: "language",
          label: "Default language",
          description: "Used for new members until they pick their own.",
          control: { kind: "value", value: "English (UK)", action: "Change" },
        },
      ],
    },
    {
      id: "housekeeping",
      title: "Housekeeping",
      description: "Small defaults that keep the workspace tidy.",
      rows: [
        {
          id: "archive",
          label: "Archive inactive projects",
          description: "Projects untouched for 12 months move to the archive automatically.",
          control: { kind: "switch", on: true },
        },
        {
          id: "digest",
          label: "Weekly summary email",
          description: "A Monday digest of what changed, to everyone with access.",
          control: { kind: "switch", on: false },
        },
      ],
    },
  ],
  "workspace/branding": [
    {
      id: "marks",
      title: "Marks",
      description: "What people see before they read a word.",
      rows: [
        {
          id: "logo",
          label: "Workspace logo",
          description: "Square, at least 256 px. Used in the switcher and on shared links.",
          control: { kind: "value", value: "northwind-mark.svg", action: "Replace" },
        },
        {
          id: "accent",
          label: "Accent colour",
          description: "Applied to buttons and highlights in shared views.",
          control: { kind: "value", value: "Default", action: "Change" },
        },
      ],
    },
    {
      id: "email",
      title: "Email",
      description: "How workspace mail presents itself.",
      rows: [
        {
          id: "header",
          label: "Show the logo in email",
          description: "Adds the workspace mark to the header of every notification.",
          control: { kind: "switch", on: true },
        },
      ],
    },
  ],
  "workspace/regions": [
    {
      id: "processing",
      title: "Processing",
      description: "Where workspace records are stored and computed.",
      rows: [
        {
          id: "primary",
          label: "Primary region",
          description: "Records live here. Moving a workspace takes up to 24 hours.",
          control: { kind: "value", value: "eu-west-1 (Ireland)", action: "Move" },
        },
        {
          id: "replica",
          label: "Read replica",
          description: "Serves dashboards closer to readers outside the primary region.",
          control: { kind: "switch", on: false },
        },
      ],
    },
  ],
  "access/members": [
    {
      id: "joining",
      title: "Joining",
      description: "How people get in.",
      rows: [
        {
          id: "domain",
          label: "Join with a company address",
          description: "Anyone with a northwind.example address can join without an invitation.",
          control: { kind: "switch", on: true },
        },
        {
          id: "approval",
          label: "Approve every request",
          description: "An owner confirms each new member before access is granted.",
          control: { kind: "switch", on: false },
        },
      ],
    },
    {
      id: "leaving",
      title: "Leaving",
      description: "What happens to someone's work when they go.",
      rows: [
        {
          id: "handover",
          label: "Reassign owned projects",
          description: "Projects transfer to the workspace owner when a member is removed.",
          control: { kind: "switch", on: true },
        },
      ],
    },
  ],
  "access/roles": [
    {
      id: "defaults",
      title: "Defaults",
      description: "What a new member can do on day one.",
      rows: [
        {
          id: "default-role",
          label: "Role for new members",
          description: "Applies to everyone who joins without an explicit invitation role.",
          control: { kind: "value", value: "Contributor", action: "Change" },
        },
        {
          id: "guest",
          label: "Allow guest access",
          description: "People outside the workspace can be invited to a single project.",
          control: { kind: "switch", on: true },
        },
      ],
    },
  ],
  "access/sign-in": [
    {
      id: "identity-provider",
      title: "Identity provider",
      description: "Where sign-in is decided.",
      rows: [
        {
          id: "sso",
          label: "Single sign-on",
          description: "People sign in through your identity provider instead of a password.",
          control: { kind: "value", value: "Not configured", action: "Set up" },
          attention: "Needs a decision",
        },
        {
          id: "enforce",
          label: "Require single sign-on",
          description: "Password sign-in is refused once your provider is connected.",
          control: { kind: "switch", on: false },
        },
      ],
    },
    {
      id: "second-factor",
      title: "Second factor",
      description: "What is asked for after the password.",
      rows: [
        {
          id: "mfa",
          label: "Require a second factor",
          description: "Everyone signs in with an authenticator app or a hardware key.",
          control: { kind: "switch", on: false },
          attention: "Needs a decision",
        },
        {
          id: "session",
          label: "Session length",
          description: "How long a signed-in session lasts before it asks again.",
          control: { kind: "value", value: "30 days", action: "Change" },
        },
      ],
    },
  ],
  "data/retention": [
    {
      id: "records",
      title: "Records",
      description: "How long each kind of record is kept.",
      rows: [
        {
          id: "projects",
          label: "Archived projects",
          description: "Deleted permanently once this period has passed.",
          control: { kind: "value", value: "24 months", action: "Change" },
        },
        {
          id: "drafts",
          label: "Unpublished drafts",
          description: "Drafts nobody has opened are cleared on this schedule.",
          control: { kind: "value", value: "90 days", action: "Change" },
        },
      ],
    },
  ],
  "data/exports": [
    {
      id: "scheduled",
      title: "Scheduled",
      description: "Extracts that run without anyone asking.",
      rows: [
        {
          id: "nightly",
          label: "Nightly extract",
          description: "A full snapshot delivered to the connected storage bucket.",
          control: { kind: "switch", on: true },
        },
        {
          id: "format",
          label: "Delivery format",
          description: "Applies to both scheduled and on-demand extracts.",
          control: { kind: "value", value: "Parquet", action: "Change" },
        },
      ],
    },
    {
      id: "on-demand",
      title: "On demand",
      description: "What a member can pull for themselves.",
      rows: [
        {
          id: "self-serve",
          label: "Let members export",
          description: "Contributors can download a project without asking an owner.",
          control: { kind: "switch", on: false },
        },
      ],
    },
  ],
  "data/audit-log": [
    {
      id: "coverage",
      title: "Coverage",
      description: "What the log records.",
      rows: [
        {
          id: "reads",
          label: "Record read events",
          description: "Logs who opened a project, not only who changed one.",
          control: { kind: "switch", on: false },
          attention: "Needs a decision",
        },
        {
          id: "keep",
          label: "Keep entries for",
          description: "Entries older than this are removed and cannot be recovered.",
          control: { kind: "value", value: "12 months", action: "Change" },
        },
      ],
    },
  ],
  "integrations/connected-apps": [
    {
      id: "installed",
      title: "Installed",
      description: "Apps with standing access to this workspace.",
      rows: [
        {
          id: "chat",
          label: "Chat notifications",
          description: "Posts project updates into the channel you choose.",
          control: { kind: "switch", on: true },
        },
        {
          id: "calendar",
          label: "Calendar sync",
          description: "Mirrors project milestones into the workspace calendar.",
          control: { kind: "switch", on: false },
        },
      ],
    },
    {
      id: "review",
      title: "Review",
      description: "How new apps are admitted.",
      rows: [
        {
          id: "approval",
          label: "Owner approval required",
          description: "An owner reviews every app before it can be installed.",
          control: { kind: "switch", on: true },
        },
      ],
    },
  ],
  "integrations/webhooks": [
    {
      id: "delivery",
      title: "Delivery",
      description: "Where workspace events are sent.",
      rows: [
        {
          id: "endpoint",
          label: "Endpoint",
          description: "Events are delivered as JSON. Failures retry for one hour.",
          control: { kind: "value", value: "hooks.northwind.example", action: "Change" },
        },
        {
          id: "signing",
          label: "Sign every delivery",
          description: "Adds a signature header so your receiver can verify the sender.",
          control: { kind: "switch", on: true },
        },
      ],
    },
  ],
  "integrations/tokens": [
    {
      id: "issuance",
      title: "Issuance",
      description: "Who may create long-lived tokens, and for how long.",
      rows: [
        {
          id: "who",
          label: "Who can issue",
          description: "Contributors can issue tokens scoped to projects they own.",
          control: { kind: "value", value: "Owners only", action: "Change" },
        },
        {
          id: "expiry",
          label: "Maximum lifetime",
          description: "A token issued today stops working after this period.",
          control: { kind: "value", value: "90 days", action: "Change" },
        },
      ],
    },
  ],
};

/** One entry of the change history the right-hand dock shows. */
export interface ChangeEntry {
  id: string;
  /** Who made the change. */
  actor: string;
  /** Two-letter fallback for the avatar. */
  initials: string;
  /** What changed, in one line. */
  summary: string;
  /** When, already humanized — this block does no date formatting. */
  at: string;
  /** The settings area it landed in, so the list is scannable. */
  area: string;
}

export const DEMO_CHANGE_LOG: ChangeEntry[] = [
  {
    id: "c1",
    actor: "Ada Okonkwo",
    initials: "AO",
    summary: "Turned on approval for every new app.",
    at: "12 minutes ago",
    area: "Integrations",
  },
  {
    id: "c2",
    actor: "Bruno Lima",
    initials: "BL",
    summary: "Shortened the session length to 30 days.",
    at: "2 hours ago",
    area: "Access",
  },
  {
    id: "c3",
    actor: "Sofia Tan",
    initials: "ST",
    summary: "Moved archived-project retention to 24 months.",
    at: "Yesterday",
    area: "Data",
  },
  {
    id: "c4",
    actor: "Ada Okonkwo",
    initials: "AO",
    summary: "Enabled the nightly extract to the storage bucket.",
    at: "Yesterday",
    area: "Data",
  },
  {
    id: "c5",
    actor: "Nora Patel",
    initials: "NP",
    summary: "Renamed the workspace to Northwind Analytics.",
    at: "3 days ago",
    area: "Workspace",
  },
];
