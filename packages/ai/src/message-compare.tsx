"use client";

/**
 * MessageCompare — side-by-side comparison of 2-4 model responses to the same
 * prompt (issue #23). The one-at-a-time sibling of `MessageBranch`
 * (`message.tsx`): `MessageBranch` switches between responses; `MessageCompare`
 * shows several at once, each with its own status, its own scroll position, and
 * its own `MessageFeedback`.
 *
 * Architecture (lifted state, INTERNAL-ONLY — not the ChartFrame/PromptInputProvider
 * PUBLIC-provider shape): `MessageCompareProvider` + `useMessageCompare()` hold the
 * `state`/`actions`/`meta` that back the grid, but both are unexported implementation
 * details, like `ChartFrameProvider` (`.claude/rules/chart-components.md` — "not
 * exported publicly"). `MessageCompare` always mounts its own private instance and
 * treats every child as a column (`Children.toArray`), so there is no seam where an
 * ambient provider or a sibling control could attach to that SAME instance without
 * corrupting the grid (an extra `ResizablePanel`, or a spurious tab with no model
 * name). The supported way to add a "Sync scroll" toggle beside the grid is the
 * ordinary controlled-prop pattern — external `useState` plus `syncScroll`/
 * `onSyncScrollChange` on `MessageCompare` (see `SyncedScrollDemo` in
 * `message-compare.stories.tsx`) — which needs neither export. Column registration
 * and the scroll-sync broadcast live on a second, also-unexported context — the same
 * internal-context-splitting shape `context-panel.tsx` uses for its own refs.
 *
 * Independent streaming/scroll (the issue's core requirement): a column never
 * auto-scrolls itself or a sibling — there is no shared "stick to bottom"
 * driver here (that's `Conversation`'s job for a single transcript). Content
 * growing in one column therefore cannot move a sibling's scroll position by
 * construction; the only way scroll moves across columns is the opt-in
 * `syncScroll` broadcast below.
 *
 * Responsive collapse: under the `md` breakpoint (768px, the same threshold
 * `useIsMobile` already drives for `ContextPanel`'s Sheet fallback) the
 * side-by-side grid becomes a `Tabs` strip, per the issue. Every column stays
 * mounted (`forceMount` + Radix's own `hidden` attribute on the inactive
 * panel) rather than unmounting on tab switch, so a column's scroll position
 * survives flipping between tabs.
 */

import {
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  use,
  Children,
  Fragment,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ChatStatus } from "ai";
import { AlertTriangleIcon } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useIsMobile,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { Shimmer } from "./shimmer";

// ── Types ─────────────────────────────────────────────────────────────────────

/** The minimum a column needs to identify itself — mainly its accessible name. */
export interface MessageCompareModel {
  /** Rendered in the column header AND used as the region's `aria-label`. */
  name: string;
  /** Optional stable id, e.g. for analytics — not used for layout or a11y. */
  id?: string;
}

/** `MessageCompare` supports 2-4 side-by-side responses (issue #23). */
export type MessageCompareColumnsCount = 2 | 3 | 4;

interface MessageCompareState {
  syncScroll: boolean;
}

interface MessageCompareActions {
  setSyncScroll: (value: boolean) => void;
}

interface MessageCompareMeta {
  columns: MessageCompareColumnsCount;
  isMobile: boolean;
}

interface MessageCompareContextValue {
  state: MessageCompareState;
  actions: MessageCompareActions;
  meta: MessageCompareMeta;
}

// ── Internal state context (NOT exported — see the file's architecture comment) ─

const MessageCompareContext = createContext<MessageCompareContextValue | null>(null);

/**
 * INTERNAL — reads the `state`/`actions`/`meta` `MessageCompareProvider` computes.
 * Not exported: `MessageCompare` always owns a private `MessageCompareProvider`
 * instance, so there is no ambient instance for an outside caller to read.
 */
function useMessageCompare(): MessageCompareContextValue {
  const ctx = use(MessageCompareContext);
  if (!ctx) {
    throw new Error("useMessageCompare must be used within a MessageCompareProvider.");
  }
  return ctx;
}

// ── Internal context (column registry + scroll broadcast — not public API) ───

interface MessageCompareColumnEntry {
  node: HTMLDivElement;
  /** Set right before a programmatic scroll so the column's own handler knows
   *  to swallow the resulting `scroll` event instead of re-broadcasting it. */
  suppressNextScroll: boolean;
}

interface MessageCompareInternalValue {
  registerColumn: (id: string, node: HTMLDivElement | null) => void;
  reportScroll: (id: string) => void;
}

const MessageCompareInternalContext = createContext<MessageCompareInternalValue | null>(null);

function useMessageCompareInternal(): MessageCompareInternalValue {
  const ctx = use(MessageCompareInternalContext);
  if (!ctx) {
    throw new Error("MessageCompareColumn must be used within a MessageCompare.");
  }
  return ctx;
}

// ── Provider (INTERNAL — not exported; see the file's architecture comment) ────

interface MessageCompareProviderProps {
  children: ReactNode;
  columns: MessageCompareColumnsCount;
  /** Controlled sync-scroll flag. Omit for the uncontrolled default. */
  syncScroll?: boolean;
  /** Uncontrolled initial value. @default false */
  defaultSyncScroll?: boolean;
  onSyncScrollChange?: (value: boolean) => void;
}

function MessageCompareProvider({
  children,
  columns,
  syncScroll: syncScrollProp,
  defaultSyncScroll = false,
  onSyncScrollChange,
}: MessageCompareProviderProps) {
  const isControlled = syncScrollProp !== undefined;
  const [internalSyncScroll, setInternalSyncScroll] = useState(defaultSyncScroll);
  const syncScroll = isControlled ? syncScrollProp : internalSyncScroll;
  const isMobile = useIsMobile();

  const setSyncScroll = useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalSyncScroll(value);
      onSyncScrollChange?.(value);
    },
    [isControlled, onSyncScrollChange],
  );

  // A ref, not state: scroll happens far too often to route through a render.
  const columnsRef = useRef<Map<string, MessageCompareColumnEntry>>(new Map());
  const syncScrollRef = useRef(syncScroll);
  useEffect(() => {
    syncScrollRef.current = syncScroll;
  }, [syncScroll]);

  const registerColumn = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) columnsRef.current.set(id, { node, suppressNextScroll: false });
    else columnsRef.current.delete(id);
  }, []);

  const reportScroll = useCallback((id: string) => {
    const entry = columnsRef.current.get(id);
    if (!entry) return;

    // This scroll was OUR OWN programmatic write (a broadcast landing on this
    // column) — swallow it once rather than re-broadcasting, which is what
    // would otherwise ping-pong two synced columns back and forth.
    if (entry.suppressNextScroll) {
      entry.suppressNextScroll = false;
      return;
    }

    if (!syncScrollRef.current) return;

    const { node } = entry;
    const range = node.scrollHeight - node.clientHeight;
    const ratio = range > 0 ? node.scrollTop / range : 0;

    columnsRef.current.forEach((other, otherId) => {
      if (otherId === id) return;
      const otherRange = other.node.scrollHeight - other.node.clientHeight;
      if (otherRange <= 0) return;
      other.suppressNextScroll = true;
      other.node.scrollTop = ratio * otherRange;
    });
  }, []);

  const state = useMemo<MessageCompareState>(() => ({ syncScroll }), [syncScroll]);
  const actions = useMemo<MessageCompareActions>(() => ({ setSyncScroll }), [setSyncScroll]);
  const meta = useMemo<MessageCompareMeta>(() => ({ columns, isMobile }), [columns, isMobile]);
  const contextValue = useMemo<MessageCompareContextValue>(
    () => ({ state, actions, meta }),
    [state, actions, meta],
  );
  const internalValue = useMemo<MessageCompareInternalValue>(
    () => ({ registerColumn, reportScroll }),
    [registerColumn, reportScroll],
  );

  return (
    <MessageCompareContext value={contextValue}>
      <MessageCompareInternalContext value={internalValue}>
        {children}
      </MessageCompareInternalContext>
    </MessageCompareContext>
  );
}

// ── MessageCompare (layout) ───────────────────────────────────────────────────

function columnKey(child: ReactElement, index: number): string {
  return child.key ?? String(index);
}

export type MessageCompareProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** `MessageCompareColumn` elements — 2 to 4. */
  children: ReactNode;
  columns: MessageCompareColumnsCount;
  /** Controlled sync-scroll flag. Omit for the uncontrolled default (off). */
  syncScroll?: boolean;
  /** Uncontrolled initial value. @default false */
  defaultSyncScroll?: boolean;
  onSyncScrollChange?: (value: boolean) => void;
  /** aria-label for the narrow-viewport tab strip. Defaults to microcopy. */
  tabsLabel?: string;
};

/**
 * Responsive side-by-side comparison of 2-4 `MessageCompareColumn`s. Desktop:
 * resizable columns (`ResizablePanelGroup`). Under `md`: a `Tabs` strip, per
 * the issue's named narrow-viewport treatment.
 */
export const MessageCompare = forwardRef<HTMLDivElement, MessageCompareProps>(
  function MessageCompare(
    {
      children,
      columns,
      syncScroll,
      defaultSyncScroll,
      onSyncScrollChange,
      tabsLabel,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <MessageCompareProvider
        columns={columns}
        defaultSyncScroll={defaultSyncScroll}
        onSyncScrollChange={onSyncScrollChange}
        syncScroll={syncScroll}
      >
        <MessageCompareLayout ref={ref} className={className} tabsLabel={tabsLabel} {...props}>
          {children}
        </MessageCompareLayout>
      </MessageCompareProvider>
    );
  },
);

type MessageCompareLayoutProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  tabsLabel?: string;
};

const MessageCompareLayout = forwardRef<HTMLDivElement, MessageCompareLayoutProps>(
  function MessageCompareLayout({ children, tabsLabel, className, ...props }, ref) {
    const { meta } = useMessageCompare();
    const { t } = useLocale();
    const items = Children.toArray(children) as ReactElement[];

    if (meta.isMobile) {
      const firstKey = items[0] ? columnKey(items[0], 0) : undefined;
      return (
        <div
          ref={ref}
          className={cn("flex h-full min-h-0 flex-col", className)}
          data-slot="message-compare"
          {...props}
        >
          <Tabs className="flex h-full min-h-0 flex-col" defaultValue={firstKey}>
            <TabsList
              aria-label={tabsLabel ?? t("ai.messageCompare.tabs")}
              className="w-full shrink-0"
            >
              {items.map((child, index) => {
                const key = columnKey(child, index);
                const props = child.props as { model?: MessageCompareModel };
                return (
                  <TabsTrigger className="flex-1" key={key} value={key}>
                    {props.model?.name ?? key}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {items.map((child, index) => {
              const key = columnKey(child, index);
              return (
                <TabsContent
                  className="mt-2 min-h-0 flex-1 data-[state=active]:flex"
                  forceMount
                  key={key}
                  value={key}
                >
                  {child}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn("h-full min-h-0", className)}
        data-slot="message-compare"
        {...props}
      >
        <ResizablePanelGroup direction="horizontal">
          {items.map((child, index) => (
            <Fragment key={columnKey(child, index)}>
              {index > 0 && <ResizableHandle withHandle />}
              <ResizablePanel defaultSize={100 / items.length} minSize={15}>
                {child}
              </ResizablePanel>
            </Fragment>
          ))}
        </ResizablePanelGroup>
      </div>
    );
  },
);

// ── MessageCompareColumn ──────────────────────────────────────────────────────

export type MessageCompareColumnProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Identifies the column — its `name` becomes the region's accessible name. */
  model: MessageCompareModel;
  /** In-flight state for this column's OWN response, independent of siblings. */
  status?: ChatStatus;
  /** The consumer's own `Message`/`MessageResponse` composition for this column. */
  children?: ReactNode;
};

/**
 * One labelled, independently-scrolling response column. `role="region"` +
 * `aria-label={model.name}` so a screen-reader user can tell which answer
 * they're in (issue #23 a11y requirement).
 */
export const MessageCompareColumn = forwardRef<HTMLDivElement, MessageCompareColumnProps>(
  function MessageCompareColumn({ model, status, children, className, id: idProp, ...props }, ref) {
    const { registerColumn, reportScroll } = useMessageCompareInternal();
    const { t } = useLocale();
    const generatedId = useId();
    const id = idProp ?? generatedId;

    const setScrollRef = useCallback(
      (node: HTMLDivElement | null) => registerColumn(id, node),
      [id, registerColumn],
    );
    const handleScroll = useCallback(() => reportScroll(id), [id, reportScroll]);

    const isBusy = status === "streaming" || status === "submitted";
    const isError = status === "error";

    return (
      <div
        ref={ref}
        aria-label={model.name}
        className={cn("flex h-full min-h-0 min-w-0 flex-col", className)}
        data-slot="message-compare-column"
        id={id}
        role="region"
        {...props}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
          data-slot="message-compare-column-header"
        >
          <span className="truncate text-body font-medium">{model.name}</span>
          {isBusy && (
            <span className="shrink-0" role="status" aria-live="polite">
              <Shimmer as="span" className="text-meta" duration={1.5}>
                {t("loading")}
              </Shimmer>
            </span>
          )}
          {isError && (
            <span
              className="flex shrink-0 items-center gap-1 text-meta text-destructive-text"
              role="alert"
            >
              <AlertTriangleIcon aria-hidden="true" className="size-3.5" />
              {t("ai.messageCompare.error")}
            </span>
          )}
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          data-slot="message-compare-column-body"
          onScroll={handleScroll}
          ref={setScrollRef}
          tabIndex={0}
        >
          {children}
        </div>
      </div>
    );
  },
);
