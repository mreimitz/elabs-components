/**
 * Terminal Agent Session — the first assembled screen for the coding-agent
 * CLI look-alike family (`@elabs-ai/components-terminal`, #117 work unit T14).
 *
 * Twelve components in that family were each verified in isolation. This
 * screen exists to observe the SEAM none of those stories could show: a
 * console surface sitting inside a real application frame — a sidebar, a
 * header, and an ordinary app `Card` beside it — rather than floating alone
 * on a page.
 *
 * Chosen concept (decided, see the work-unit brief): mission control inside
 * the app frame. An `AppShell`-style sidebar + header frame whose content
 * canvas hosts one console session as the focus pane, with an ordinary
 * `Card` inspector rail sitting beside it — never inside it, which is the
 * deliberate choice that keeps the console's own ink discipline
 * (`.claude/rules/terminal-components.md` § "Colour comes from the terminal
 * token group") from ever fighting an app surface's ink.
 *
 * Compose-only: every element is an existing `@elabs-ai/components-terminal`
 * / `@elabs-ai/components-ui` / `@elabs-ai/components-icons` primitive,
 * semantic tokens only, and it must read in light AND dark.
 *
 * Home: this is a cross-package COMPOSITION demo, so it lives in
 * apps/docs/stories — no single library package may own it under the
 * one-way dep rule (apps compose siblings freely). See
 * templates-admin-console.stories.tsx for the sibling template this shell
 * grammar is taken from.
 */
import { useLayoutEffect, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { Bot, LogOut, Plus, Settings, ShieldAlert, Sparkles } from "lucide-react";
import { AppIcon } from "@elabs-ai/components-icons";
import type { DiffLine } from "@elabs-ai/components-ui";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  StatusBadge,
} from "@elabs-ai/components-ui";
import {
  TerminalBanner,
  TerminalComposer,
  TerminalConsole,
  TerminalDiffHunk,
  TerminalEventLine,
  TerminalPermission,
  TerminalStatusBar,
  TerminalSurface,
  TerminalTodoList,
  TerminalToolCall,
  TerminalTranscriptRow,
  TerminalWorking,
  type TerminalTodoItem,
} from "@elabs-ai/components-terminal";

/* -------------------------------------------------------------------------- */
/*  Fixtures — one small, realistic "webapp" agent-console object model        */
/* -------------------------------------------------------------------------- */

type SessionState = "default" | "idle" | "awaiting-permission";

interface SessionSummary {
  id: string;
  label: string;
}

const SESSIONS: SessionSummary[] = [
  { id: "dark-mode", label: "Add dark mode toggle" },
  { id: "deploy-prod", label: "Deploy latest build" },
  { id: "fix-auth", label: "Fix auth redirect loop" },
];

/** Which session is active in the sidebar/breadcrumb for each state story. */
const ACTIVE_SESSION_ID: Record<SessionState, string> = {
  default: "dark-mode",
  idle: "dark-mode",
  "awaiting-permission": "deploy-prod",
};

const TODOS: TerminalTodoItem[] = [
  { id: "1", text: "Read settings-page.tsx and theme-provider.tsx", status: "done" },
  { id: "2", text: "Add a dark mode toggle control", status: "done" },
  { id: "3", text: "Wire the toggle to useTheme()", status: "active" },
  { id: "4", text: "Add a Storybook story for the toggle", status: "pending" },
];

const DIFF_LINES: DiffLine[] = [
  {
    type: "context",
    oldNumber: 12,
    newNumber: 12,
    text: '  <SettingsSection title="Appearance">',
  },
  { type: "del", oldNumber: 13, text: "    <p>More options coming soon.</p>" },
  {
    type: "add",
    newNumber: 13,
    text: "    <ThemeToggle checked={isDark} onCheckedChange={setIsDark} />",
  },
  { type: "context", oldNumber: 14, newNumber: 14, text: "  </SettingsSection>" },
];

const COMPOSER_MODES = [
  { id: "auto", label: "Auto", description: "Acts on its own judgment.", keyHint: "⇧Tab" },
  { id: "plan", label: "Plan first", description: "Proposes a plan before acting." },
];

const EFFORT_LEVELS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

/* -------------------------------------------------------------------------- */
/*  App chrome — the sidebar + header grammar, taken from                     */
/*  templates-admin-console.stories.tsx                                       */
/* -------------------------------------------------------------------------- */

function ConsoleSidebar({ activeId }: { activeId: string }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Agent Console" asChild>
              <a href="#sessions" aria-label="Agent Console — home">
                <AppIcon height={20} aria-hidden />
                <span className="grid flex-1 text-start leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-body font-semibold">Agent Console</span>
                  <span className="truncate text-meta text-sidebar-muted-foreground">
                    Coding sessions
                  </span>
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SESSIONS.map((session) => (
                <SidebarMenuItem key={session.id}>
                  <SidebarMenuButton isActive={session.id === activeId} tooltip={session.label}>
                    <Bot aria-hidden="true" />
                    <span>{session.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="New session">
              <Plus aria-hidden="true" />
              <span>New session</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip="Account">
                  <Avatar className="size-7 rounded-md">
                    <AvatarFallback className="rounded-md text-meta">PC</AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-start leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-body font-medium">Priya Chen</span>
                    <span className="truncate text-meta text-sidebar-muted-foreground">
                      priya@acme.dev
                    </span>
                  </span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-48">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Settings className="me-2 size-4" aria-hidden="true" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="me-2 size-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

/**
 * The inspector rail — an ORDINARY app `Card`, sitting beside the console,
 * never inside it. This is the seam this work unit exists to observe: a
 * `bg-card`/`text-card-foreground` surface right next to
 * `bg-terminal-background`/`text-terminal-foreground` ground, in both themes.
 */
function SessionRail({ state }: { state: SessionState }) {
  return (
    <Card className="w-72 shrink-0">
      <CardHeader>
        <CardTitle>Session</CardTitle>
        <CardDescription>
          {state === "awaiting-permission"
            ? "gpt-5.1-codex · release/2026-09-02"
            : "gpt-5.1-codex · feature/dark-mode-toggle"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state === "awaiting-permission" ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
            {/* The icon carries the tone (mark rung, judged at 3:1); the
             * words stay neutral app ink — colour is never the only channel,
             * and never the ONLY carrier of an accent tone either
             * (.claude/rules/styling-and-tokens.md § status rungs). */}
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="text-body font-medium text-foreground">Waiting for your approval</p>
              <p className="text-meta text-muted-foreground">
                Respond in the console before the agent continues.
              </p>
            </div>
          </div>
        ) : null}

        <div>
          <h3 className="text-meta font-medium text-muted-foreground">Files changed</h3>
          {state === "default" ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              <li className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-body text-foreground">
                  settings-page.tsx
                </span>
                <Badge variant="secondary">Modified</Badge>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-body text-foreground">
                  theme-provider.tsx
                </span>
                <Badge variant="secondary">Modified</Badge>
              </li>
            </ul>
          ) : (
            <p className="mt-1 text-meta text-muted-foreground">No files changed yet.</p>
          )}
        </div>

        {state === "default" ? (
          <div>
            <h3 className="text-meta font-medium text-muted-foreground">Todo</h3>
            <p className="mt-1 text-body text-foreground">2 of 4 tasks done</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  The console — the family's own components, and nothing else, inside      */
/*  TerminalSurface (keeps the console's ink discipline uncomplicated by any  */
/*  ordinary `ui` primitive nested in its subtree).                          */
/* -------------------------------------------------------------------------- */

function DefaultTranscript() {
  return (
    <>
      <TerminalBanner
        title="brand-ui Agent"
        model="gpt-5.1-codex"
        version="v3.0.0"
        workspace="~/apps/webapp"
        logo={<Bot aria-hidden="true" className="size-5 text-terminal-ansi-bright-green" />}
        capabilities={[
          { label: "Read and edit files", description: "Across this workspace" },
          {
            label: "Run commands",
            description: "In a sandboxed shell",
            icon: <Sparkles aria-hidden="true" />,
          },
        ]}
        quickActions={[{ label: "New session", keyHint: "⌘N", onSelect: fn() }]}
      />
      <TerminalTranscriptRow kind="user">
        Add a dark mode toggle to the settings page and wire it to the theme provider
      </TerminalTranscriptRow>
      <TerminalTranscriptRow kind="agent">
        Looking at the settings page and the theme provider now.
      </TerminalTranscriptRow>
      <TerminalToolCall
        toolName="Read"
        argument="src/components/settings-page.tsx"
        status="success"
        summary="128 lines read"
      />
      <TerminalToolCall
        toolName="Grep"
        argument="useTheme"
        status="success"
        summary="4 matches in 3 files"
      />
      <TerminalTranscriptRow kind="agent">
        Found the theme context. Adding a toggle control and wiring it up.
      </TerminalTranscriptRow>
      <TerminalDiffHunk
        file="src/components/settings-page.tsx"
        summary="Add a dark mode toggle wired to useTheme()"
        lines={DIFF_LINES}
      />
      <TerminalTranscriptRow kind="agent">Updating the todo list as I go.</TerminalTranscriptRow>
      <TerminalTodoList items={TODOS} />
      <TerminalEventLine label="post_tool_use" hooks={{ ran: 2, passed: 2 }} phase="after" />
      <TerminalWorking
        label="Editing settings-page.tsx…"
        elapsedMs={14000}
        tokens={5400}
        onStop={fn()}
      />
    </>
  );
}

function IdleTranscript() {
  return (
    <>
      <TerminalBanner
        title="brand-ui Agent"
        model="gpt-5.1-codex"
        version="v3.0.0"
        workspace="~/apps/webapp"
        logo={<Bot aria-hidden="true" className="size-5 text-terminal-ansi-bright-green" />}
        capabilities={[
          { label: "Read and edit files", description: "Across this workspace" },
          { label: "Run commands", description: "In a sandboxed shell" },
        ]}
        quickActions={[{ label: "New session", keyHint: "⌘N", onSelect: fn() }]}
      />
      {/*
       * Reuse the empty-state treatment the sibling block already ships
       * (`registry/blocks/terminal-session-idle/terminal-session-idle.tsx`,
       * `patterns-blocks-terminal-session-idle--empty-transcript`) rather
       * than authoring a third variant of it — the transcript has nothing
       * else to show, so it says so.
       */}
      <p className="text-terminal-muted">No messages yet — type a prompt to begin.</p>
    </>
  );
}

function AwaitingPermissionTranscript() {
  return (
    <>
      <TerminalTranscriptRow kind="user">
        Deploy the latest build to production
      </TerminalTranscriptRow>
      <TerminalTranscriptRow kind="agent">
        This runs the deploy script against the production environment.
      </TerminalTranscriptRow>
      <TerminalToolCall toolName="Bash" argument="pnpm deploy:prod" status="pending" />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  The screen                                                                 */
/* -------------------------------------------------------------------------- */

function AgentSessionScreen({ state }: { state: SessionState }) {
  /*
   * Pin the transcript to its newest line, the way a real console does. The
   * package owns no scroll container by contract (see
   * `.claude/rules/terminal-components.md` § "This package owns no scroll
   * container"), so the viewport AND its scroll position are the caller's job —
   * this is the composition showing how, not a `TerminalSurface` behaviour.
   * `useLayoutEffect` so it lands before paint and the screen never flashes the
   * top of the transcript first.
   */
  const transcriptRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state]);

  const activeId = ACTIVE_SESSION_ID[state];
  const activeLabel = SESSIONS.find((session) => session.id === activeId)?.label ?? "Session";

  return (
    <SidebarProvider defaultOpen className="h-dvh overflow-hidden">
      <ConsoleSidebar activeId={activeId} />

      <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-surface-elevated/80 px-3 backdrop-blur">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-1 h-5" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:flex">
                <BreadcrumbLink href="#sessions">Agent Sessions</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{activeLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ms-auto flex items-center gap-2">
            {state === "awaiting-permission" ? (
              <StatusBadge status="awaiting-approval" />
            ) : state === "idle" ? (
              <StatusBadge status={{ label: "Idle", tone: "neutral" }} />
            ) : (
              <StatusBadge status="running" />
            )}
          </div>
        </header>

        {/*
         * A plain `<div>`, deliberately NOT `<main>`: `SidebarInset` already
         * renders a `<main data-slot="sidebar-inset">` (templates-admin-console
         * does the same thing this screen originally copied — a second nested
         * `<main>` here is a real axe violation (`landmark-main-is-top-level` /
         * `landmark-no-duplicate-main`) this unit's browser+axe pass caught
         * that no unit test could. See the T14 report for the finding.
         */}
        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
          {/*
           * ADR 0033: the console is ONE frame. `TerminalConsole` draws the
           * edge, radius, ground and lift once; the transcript, the permission
           * prompt, the composer and the status bar sit inside it as flush
           * regions separated by a single seam. There is no `gap-*` here on
           * purpose — a gap would put a strip of page background between two
           * regions of the same window.
           */}
          <TerminalConsole className="min-h-0 min-w-0 flex-1">
            {/*
             * `mt-auto` on the first child bottom-anchors the transcript, so
             * short content sits just above the composer the way a real
             * terminal's cursor does instead of floating at the top of a
             * surface stretched to fill the viewport.
             *
             * It is deliberately NOT `justify-end`, which anchors identically
             * but strands overflow at the START of a scroll container: Chrome
             * leaves `scrollHeight === clientHeight`, so the earliest rows sit
             * above the box with no way to reach them. Measured on this exact
             * story — 190px of transcript unreachable with `justify-end`;
             * `scrollHeight` 824 vs `clientHeight` 622 and a 202px scroll
             * range with `mt-auto`.
             *
             * A composition-level choice for now, not a `TerminalSurface`
             * default — that is an open question for the architect.
             */}
            <TerminalSurface
              ref={transcriptRef}
              className="min-h-0 flex-1 overflow-y-auto [&>*:first-child]:mt-auto"
            >
              {state === "default" ? <DefaultTranscript /> : null}
              {state === "idle" ? <IdleTranscript /> : null}
              {state === "awaiting-permission" ? <AwaitingPermissionTranscript /> : null}
            </TerminalSurface>

            {state === "awaiting-permission" ? (
              <TerminalPermission preview="pnpm deploy:prod" variant="boxed" />
            ) : null}

            {/*
             * ADR 0022 case 4: `busy` WITHOUT `onStop`. `TerminalWorking` below
             * owns cancellation for the in-flight turn, so this composer must not
             * render a second, identically-named "Stop" — but it still reports the
             * turn state (`data-busy`) and still accepts a follow-up, which is the
             * whole point of the merged primary-action contract. Before #128 this
             * combination rendered a dead Stop button calling `onStop?.()` on
             * `undefined`, so the story had to omit `busy` altogether to avoid it.
             */}
            <TerminalComposer
              busy={state === "default"}
              onSubmit={fn()}
              modes={state === "default" ? COMPOSER_MODES : undefined}
              effortLevels={state === "default" ? EFFORT_LEVELS : undefined}
              // Awaiting a decision: the permission prompt above is the focal
              // element and the composer is not. Under ADR 0033 that contrast is
              // STRUCTURAL, not a class this screen applies: inside a
              // `TerminalConsole` every region is borderless and unlifted, while
              // `TerminalPermission variant="boxed"` still draws its own inner
              // frame around the prompt and its choices. The earlier
              // `border-transparent shadow-none` override is therefore gone — it
              // would now negate declarations the region no longer has. Nothing
              // here is `disabled`/`aria-disabled`: the field stays a real,
              // focusable, enabled control, because a mid-turn follow-up must
              // remain composable. Never reach for an opacity or alpha wash to
              // recede a console region — the light canvas would bleed through
              // `text-terminal-foreground`'s dark ground, the inverse-ink failure
              // `.claude/rules/terminal-components.md` warns about.
            />

            <TerminalStatusBar
              branch={
                state === "awaiting-permission" ? "release/2026-09-02" : "feature/dark-mode-toggle"
              }
              workspace="~/apps/webapp"
              connections={{ connected: state === "awaiting-permission" ? 4 : 3, total: 4 }}
              context={{
                used: state === "idle" ? "4K" : state === "awaiting-permission" ? "52K" : "38K",
                limit: "200K",
              }}
              turn={state === "default" ? { current: 2, total: 4 } : undefined}
            />
          </TerminalConsole>

          <SessionRail state={state} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stories                                                                    */
/* -------------------------------------------------------------------------- */

const meta = {
  title: "Patterns/Templates/Terminal Agent Session",
  component: AgentSessionScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The coding-agent CLI look-alike family (`@elabs-ai/components-terminal`, #117) " +
          "assembled into one real screen: an AppShell-style sidebar and header frame around " +
          "a single console session, with an ordinary app Card sitting beside it as an " +
          "inspector rail. This is the first place the family's twelve components are seen " +
          "together and against app chrome, rather than each in isolation.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AgentSessionScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mid-turn: the agent is working, a diff is proposed, todos are partially done. */
export const Default: Story = {
  args: { state: "default" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "brand-ui Agent" })).toBeInTheDocument();
    await expect(
      canvas.getByText("Add a dark mode toggle wired to useTheme()"),
    ).toBeInTheDocument();
    await expect(
      canvasElement.querySelector('[data-slot="terminal-working-label"]'),
    ).toHaveTextContent("Editing settings-page.tsx…");
    await expect(canvas.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  },
};

/** A settled session: no working line, composer ready, an empty-ish transcript with just the banner. */
export const Idle: Story = {
  args: { state: "idle" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "brand-ui Agent" })).toBeInTheDocument();
    // The empty-state message the sibling block already ships
    // (`patterns-blocks-terminal-session-idle--empty-transcript`) — the
    // transcript has nothing else to show, so it says so.
    await expect(canvas.getByText("No messages yet — type a prompt to begin.")).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText("Type your next instruction…")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  },
};

/** A pending permission box is the focal element; the composer is not where attention goes. */
export const AwaitingPermission: Story = {
  args: { state: "awaiting-permission" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Bash command")).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Yes" })).toBeInTheDocument();
    const composer = canvas.getByPlaceholderText("Type your next instruction…");
    await expect(composer).toBeInTheDocument();
    // The composer is visually RECESSED while a decision is pending, never
    // functionally disabled — it stays a real, focusable, enabled control
    // (`.claude/rules/interaction-guidelines.md`'s `aria-disabled`-only rule
    // for "nothing to submit" doesn't even come up here, because nothing is
    // disabled at all).
    await expect(composer).toBeEnabled();
    await expect(composer).not.toHaveAttribute("aria-disabled");
  },
};
