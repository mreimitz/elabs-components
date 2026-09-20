"use client";

/**
 * Template — a generative-UI assistant: the agent answers with SCREENS, not paragraphs.
 *
 * Five conversations, each a real use of A2UI: a refund decision, an analytics answer with
 * charts, an incident form, a release plan and a surface the catalog refuses. The agent's turn
 * streams in as JSON and builds up on screen; every button, field and chart click reaches the
 * app as a NAMED action; the app answers with a line and, usually, the agent's next surface.
 *
 * The inspector on the right is the part to show an engineer: the bytes on the wire, the actions
 * the host received, and the catalog the agent is allowed to draw from.
 *
 * Wire your model where `SCENARIOS` is read, and your verbs where `onAction` looks up a reply.
 *
 * Copy-own it: `npx shadcn add a2ui-assistant-page`.
 */
import {
  A2uiSurface,
  type A2uiActionHandler,
  type A2uiError,
  type A2uiSurfaceSpec,
} from "@elabs-ai/components-ai";
import {
  Badge,
  Button,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  BarChart3,
  Bot,
  CornerDownRight,
  LifeBuoy,
  Rocket,
  RotateCcw,
  ShieldAlert,
  Siren,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionLog, useActionLog } from "@/components/a2ui-parts/action-log";
import { showcaseCatalog } from "@/components/a2ui-parts/catalog";
import { CatalogBrowser } from "@/components/a2ui-parts/catalog-browser";
import { JsonPane } from "@/components/a2ui-parts/json-pane";
import { SCENARIOS, type Scenario } from "@/components/a2ui-parts/scenarios";
import { useStreamedSurface } from "@/components/a2ui-parts/use-streamed-surface";
import {
  WorkspaceShell,
  type WorkspaceNavGroup,
} from "@/components/workspace-shell/workspace-shell";

const ICONS: Record<string, LucideIcon> = {
  refund: LifeBuoy,
  revenue: BarChart3,
  incident: Siren,
  rollout: Rocket,
  guardrail: ShieldAlert,
};

type Turn =
  | { id: number; role: "you"; text: string; viaSurface?: boolean }
  | { id: number; role: "agent"; text: string; surface?: A2uiSurfaceSpec };

const openingTurns = (scenario: Scenario): Turn[] => [
  { id: 1, role: "you", text: scenario.prompt },
  { id: 2, role: "agent", text: scenario.intro, surface: scenario.surface },
];

export interface A2uiAssistantPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  /** Which conversation opens first. */
  defaultScenario?: "refund" | "revenue" | "incident" | "rollout" | "guardrail";
  /** Which inspector tab opens first. */
  defaultInspector?: "wire" | "actions" | "catalog";
}

export default function A2uiAssistantPage({
  frame = "viewport",
  defaultScenario = "refund",
  defaultInspector = "wire",
}: A2uiAssistantPageProps) {
  const [scenarioId, setScenarioId] = useState<string>(defaultScenario);
  const scenario = SCENARIOS.find((entry) => entry.id === scenarioId) ?? SCENARIOS[0]!;
  const [turns, setTurns] = useState<Turn[]>(() => openingTurns(scenario));
  const [problems, setProblems] = useState<A2uiError[]>([]);
  const log = useActionLog();

  // The surface the person can act on is the agent's LATEST one; earlier ones are history.
  const live = useMemo(
    () => [...turns].reverse().find((turn) => turn.role === "agent" && turn.surface),
    [turns],
  );
  const liveSurface = live?.role === "agent" ? live.surface : undefined;
  const stream = useStreamedSurface(liveSurface ?? scenario.surface);

  const openScenario = useCallback(
    (id: string) => {
      const next = SCENARIOS.find((entry) => entry.id === id);
      if (!next) return;
      setScenarioId(id);
      setTurns(openingTurns(next));
      setProblems([]);
      log.clear();
    },
    [log],
  );

  const reply = useCallback(
    (actionName: string) => {
      const answer = scenario.replies[actionName];
      if (!answer) return;
      setProblems([]);
      setTurns((current) => {
        const id = (current[current.length - 1]?.id ?? 0) + 1;
        return [
          ...current,
          { id, role: "you", text: answer.youSaid, viaSurface: true },
          { id: id + 1, role: "agent", text: answer.agentSays, surface: answer.surface },
        ];
      });
    },
    [scenario],
  );

  const onAction = useCallback<A2uiActionHandler>(
    (action, context) => {
      log.record(action, context);
      reply(action.name);
    },
    [log, reply],
  );

  // A new exchange starts at the top of the view: the person's line, then the answer reading
  // downwards as it streams in — never pinned to the bottom, where a long answer would open on
  // its last button. Only the conversation scrolls; `scrollIntoView` would move the host page too.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const asks = scroller.querySelectorAll<HTMLElement>('[data-role="you"]');
    const latest = asks[asks.length - 1];
    const top = latest && asks.length > 1 ? latest.offsetTop - 16 : 0;
    scroller.scrollTo({ top, behavior: asks.length > 1 ? "smooth" : "auto" });
  }, [turns.length]);

  const NAV: WorkspaceNavGroup[] = [
    {
      label: "Conversations",
      items: SCENARIOS.map((entry) => ({
        id: entry.id,
        label: entry.label,
        href: `#${entry.id}`,
        icon: ICONS[entry.id] ?? Bot,
      })),
    },
  ];

  return (
    <WorkspaceShell
      activeId={scenario.id}
      dock={{
        title: "Inspector",
        description: "What crossed the wire, what the app received, what the agent may draw.",
        showLabel: "Show the inspector",
        hideLabel: "Hide the inspector",
        defaultOpen: true,
        defaultWidth: 420,
        children: (
          <Tabs className="flex h-full min-h-0 flex-col" defaultValue={defaultInspector}>
            <TabsList className="mx-3 mt-1 self-start">
              <TabsTrigger value="wire">Wire</TabsTrigger>
              <TabsTrigger value="actions">
                Actions{log.entries.length > 0 ? ` (${log.entries.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="catalog">Catalog</TabsTrigger>
            </TabsList>
            <TabsContent className="min-h-0 flex-1" value="wire">
              <div className="flex h-full min-h-0 flex-col">
                <p className="flex items-center justify-between border-y border-border px-3 py-2 text-meta text-muted-foreground">
                  <span>tool result · application/a2ui+json</span>
                  <span className="tabular-nums">
                    {stream.text.length.toLocaleString("en-US")} /{" "}
                    {stream.full.length.toLocaleString("en-US")} bytes
                  </span>
                </p>
                <JsonPane
                  className="min-h-0 flex-1"
                  isStreaming={stream.isStreaming}
                  text={stream.text}
                />
              </div>
            </TabsContent>
            <TabsContent className="min-h-0 flex-1 border-t border-border" value="actions">
              <ActionLog
                emptyHint="Use the agent's surface: every click and change lands here as a named action."
                entries={log.entries}
              />
            </TabsContent>
            <TabsContent className="min-h-0 flex-1 border-t border-border" value="catalog">
              <CatalogBrowser />
            </TabsContent>
          </Tabs>
        ),
      }}
      frame={frame}
      inset="flush"
      nav={NAV}
      onNavigate={(item) => openScenario(item.id)}
      orgName="Northwind Outdoor"
      productName="Atlas Assistant"
      trail={[
        { href: "#assistant", label: "Assistant" },
        { href: `#${scenario.id}`, label: scenario.label },
      ]}
      user={{ name: "Noor Haddad", email: "noor@northwind.example" }}
    >
      <div className="@container flex h-full min-h-0 flex-col">
        <header className="flex h-header shrink-0 items-center gap-2 border-b border-border px-4 @3xl:px-8">
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-subtitle font-semibold text-foreground">
              {scenario.label}
            </h1>
            <p className="truncate text-meta text-muted-foreground">{scenario.shows}</p>
          </div>
          <Badge className="ms-auto" variant={stream.isStreaming ? "info" : "outline"}>
            {stream.isStreaming
              ? `${scenario.agent} is writing · ${Math.round(stream.progress * 100)} %`
              : scenario.agent}
          </Badge>
          <Button onClick={() => openScenario(scenario.id)} size="sm" variant="ghost">
            <RotateCcw aria-hidden="true" />
            Restart
          </Button>
        </header>
        <Progress
          aria-label="Surface received"
          className={cn("h-0.5 rounded-none", stream.isStreaming ? "opacity-100" : "opacity-0")}
          value={Math.round(stream.progress * 100)}
        />

        <div className="relative min-h-0 flex-1 overflow-y-auto" ref={scrollerRef} tabIndex={0}>
          <ol
            aria-label="Conversation"
            className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 @3xl:px-8"
          >
            {turns.map((turn) =>
              turn.role === "you" ? (
                <li className="flex justify-end" data-role="you" key={turn.id}>
                  <p
                    className={cn(
                      "max-w-prose rounded-lg px-3 py-2 text-body",
                      turn.viaSurface
                        ? "inline-flex items-center gap-1.5 border border-border text-muted-foreground"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    {turn.viaSurface ? (
                      <CornerDownRight aria-hidden="true" className="size-4 shrink-0" />
                    ) : null}
                    {turn.text}
                  </p>
                </li>
              ) : (
                <li className="flex flex-col gap-3" key={turn.id}>
                  <p className="flex items-start gap-2 text-body text-foreground">
                    <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      <span className="sr-only">{scenario.agent}: </span>
                      {turn.text}
                    </span>
                  </p>
                  {turn.surface ? (
                    turn === live ? (
                      <div className="flex flex-col gap-3">
                        <A2uiSurface
                          catalog={showcaseCatalog}
                          isStreaming={stream.isStreaming}
                          onAction={onAction}
                          onError={setProblems}
                          surface={stream.text}
                        />
                        {problems.length > 0 && scenario.replies["request-repair"] ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <Button onClick={() => reply("request-repair")}>
                              Send the {problems.length} problems back to the agent
                            </Button>
                            <p className="text-meta text-muted-foreground">
                              Nothing from the refused surface was rendered.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      // An answered surface is history: visible, not operable.
                      <div className="opacity-60" inert>
                        <A2uiSurface catalog={showcaseCatalog} surface={turn.surface} />
                      </div>
                    )
                  ) : null}
                </li>
              ),
            )}
          </ol>
        </div>

        <footer className="border-t border-border px-4 py-3 @3xl:px-8">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-2">
            <span className="text-meta text-muted-foreground">Ask something else:</span>
            {SCENARIOS.filter((entry) => entry.id !== scenario.id).map((entry) => (
              <Button
                key={entry.id}
                onClick={() => openScenario(entry.id)}
                size="sm"
                variant="outline"
              >
                {entry.prompt.length > 46 ? `${entry.prompt.slice(0, 44)}…` : entry.prompt}
              </Button>
            ))}
          </div>
        </footer>
      </div>
    </WorkspaceShell>
  );
}
