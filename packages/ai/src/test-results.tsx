"use client";

import { StatusBadge, StatusIcon, type Status } from "@elabs/components-ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { ChevronRightIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";
import { createContext, useContext, useMemo } from "react";

type TestStatus = "passed" | "failed" | "skipped" | "running";

/** Test status → the canonical 7-state vocabulary (#189, research 10 §B.1). */
const testStatusToCanonical: Record<TestStatus, Status> = {
  passed: "complete",
  failed: "failed",
  running: "running",
  skipped: "skipped",
};

interface TestResultsSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration?: number;
}

interface TestResultsContextType {
  summary?: TestResultsSummary;
}

const TestResultsContext = createContext<TestResultsContextType>({});

const formatDuration = (ms: number) => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

export type TestResultsHeaderProps = HTMLAttributes<HTMLDivElement>;

export const TestResultsHeader = ({ className, children, ...props }: TestResultsHeaderProps) => (
  <div
    className={cn("flex min-w-0 items-center justify-between border-b px-4 py-3", className)}
    {...props}
  >
    {children}
  </div>
);

export type TestResultsDurationProps = HTMLAttributes<HTMLSpanElement>;

export const TestResultsDuration = ({
  className,
  children,
  ...props
}: TestResultsDurationProps) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary?.duration) {
    return null;
  }

  return (
    <span
      className={cn("shrink-0 text-muted-foreground text-sm tabular-nums", className)}
      {...props}
    >
      {children ?? formatDuration(summary.duration)}
    </span>
  );
};

export type TestResultsSummaryProps = HTMLAttributes<HTMLDivElement>;

export const TestResultsSummary = ({ className, children, ...props }: TestResultsSummaryProps) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children ?? (
        <>
          <StatusBadge size="sm" status="complete">
            {summary.passed} passed
          </StatusBadge>
          {summary.failed > 0 && (
            <StatusBadge size="sm" status="failed">
              {summary.failed} failed
            </StatusBadge>
          )}
          {summary.skipped > 0 && (
            <StatusBadge size="sm" status="skipped">
              {summary.skipped} skipped
            </StatusBadge>
          )}
        </>
      )}
    </div>
  );
};

export type TestResultsProps = HTMLAttributes<HTMLDivElement> & {
  summary?: TestResultsSummary;
};

export const TestResults = ({ summary, className, children, ...props }: TestResultsProps) => {
  const contextValue = useMemo(() => ({ summary }), [summary]);

  return (
    <TestResultsContext.Provider value={contextValue}>
      <div className={cn("overflow-hidden rounded-lg border bg-background", className)} {...props}>
        {children ??
          (summary && (
            <TestResultsHeader>
              <TestResultsSummary />
              <TestResultsDuration />
            </TestResultsHeader>
          ))}
      </div>
    </TestResultsContext.Provider>
  );
};

export type TestResultsProgressProps = HTMLAttributes<HTMLDivElement>;

export const TestResultsProgress = ({
  className,
  children,
  ...props
}: TestResultsProgressProps) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary) {
    return null;
  }

  const passedPercent = (summary.passed / summary.total) * 100;
  const failedPercent = (summary.failed / summary.total) * 100;

  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      {children ?? (
        <>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-success transition-[width] duration-base ease-standard motion-reduce:transition-none"
              style={{ width: `${passedPercent}%` }}
            />
            <div
              className="bg-destructive transition-[width] duration-base ease-standard motion-reduce:transition-none"
              style={{ width: `${failedPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-muted-foreground text-xs tabular-nums">
            <span>
              {summary.passed}/{summary.total} tests passed
            </span>
            <span>{passedPercent.toFixed(0)}%</span>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * TestResultsMeta — the summary badges + progress bar block that sits between
 * the header and the suite list. Provides consistent `px-4 pt-3 pb-4` padding
 * so callers do not need ad-hoc wrapper divs.
 */
export type TestResultsMetaProps = HTMLAttributes<HTMLDivElement>;

export const TestResultsMeta = ({ className, children, ...props }: TestResultsMetaProps) => (
  <div className={cn("space-y-3 px-4 pb-4 pt-3", className)} {...props}>
    {children}
  </div>
);

/**
 * TestResultsContent — the suite list. Uses `divide-y` instead of `space-y`
 * so suites are separated by a single structural divider, not nested boxes.
 */
export type TestResultsContentProps = HTMLAttributes<HTMLDivElement>;

export const TestResultsContent = ({ className, children, ...props }: TestResultsContentProps) => (
  <div className={cn("divide-y", className)} {...props}>
    {children}
  </div>
);

interface TestSuiteContextType {
  name: string;
  status: TestStatus;
}

const TestSuiteContext = createContext<TestSuiteContextType>({
  name: "",
  status: "passed",
});

// The local status icon/color records were the 5th status idiom (#189);
// re-pointed to the canonical `StatusIcon` vocabulary from @elabs/components-ui.
const TestStatusIcon = ({ status }: { status: TestStatus }) => (
  <StatusIcon className="shrink-0" status={testStatusToCanonical[status]} />
);

export type TestSuiteProps = ComponentProps<typeof Collapsible> & {
  name: string;
  status: TestStatus;
};

/**
 * TestSuite — one expandable file/suite row. Uses a quiet left rail
 * (`border-s-2`) as the sole focal separation gesture inside the divider-
 * separated list. No nested rounded box: that was redundant border-on-region
 * with no fill change (separation grammar).
 */
export const TestSuite = ({ name, status, className, children, ...props }: TestSuiteProps) => {
  const contextValue = useMemo(() => ({ name, status }), [name, status]);

  return (
    <TestSuiteContext.Provider value={contextValue}>
      <Collapsible className={cn("group/suite", className)} {...props}>
        {children}
      </Collapsible>
    </TestSuiteContext.Provider>
  );
};

export type TestSuiteNameProps = ComponentProps<typeof CollapsibleTrigger>;

export const TestSuiteName = ({ className, children, ...props }: TestSuiteNameProps) => {
  const { name, status } = useContext(TestSuiteContext);

  return (
    <CollapsibleTrigger
      className={cn(
        "group flex w-full items-center gap-2 px-4 py-2.5 text-start transition-colors duration-fast ease-standard motion-reduce:transition-none hover:bg-muted/50",
        className,
      )}
      {...props}
    >
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-fast ease-standard motion-reduce:transition-none group-data-[state=open]:rotate-90" />
      <TestStatusIcon status={status} />
      <span className="min-w-0 flex-1 truncate font-medium text-sm">{children ?? name}</span>
    </CollapsibleTrigger>
  );
};

export type TestSuiteStatsProps = HTMLAttributes<HTMLDivElement> & {
  passed?: number;
  failed?: number;
  skipped?: number;
};

export const TestSuiteStats = ({
  passed = 0,
  failed = 0,
  skipped = 0,
  className,
  children,
  ...props
}: TestSuiteStatsProps) => (
  <div
    className={cn("ms-auto flex shrink-0 items-center gap-3 text-xs tabular-nums", className)}
    {...props}
  >
    {children ?? (
      <>
        {passed > 0 && <span className="text-success-text">{passed} passed</span>}
        {failed > 0 && <span className="text-destructive-text">{failed} failed</span>}
        {skipped > 0 && <span className="text-muted-foreground">{skipped} skipped</span>}
      </>
    )}
  </div>
);

export type TestSuiteContentProps = ComponentProps<typeof CollapsibleContent>;

/**
 * TestSuiteContent — the rows inside an expanded suite. A left rail
 * (`border-s-2 border-s-border ms-6`) indents the block under the suite
 * trigger and separates it structurally without a box. Rows are divided by
 * `divide-y`.
 */
export const TestSuiteContent = ({ className, children, ...props }: TestSuiteContentProps) => (
  <CollapsibleContent className={cn("border-t", className)} {...props}>
    <div className="divide-y">{children}</div>
  </CollapsibleContent>
);

interface TestContextType {
  name: string;
  status: TestStatus;
  duration?: number;
}

const TestContext = createContext<TestContextType>({
  name: "",
  status: "passed",
});

export type TestNameProps = HTMLAttributes<HTMLSpanElement>;

export const TestName = ({ className, children, ...props }: TestNameProps) => {
  const { name } = useContext(TestContext);

  return (
    <span className={cn("min-w-0 flex-1 truncate", className)} {...props}>
      {children ?? name}
    </span>
  );
};

export type TestDurationProps = HTMLAttributes<HTMLSpanElement>;

export const TestDuration = ({ className, children, ...props }: TestDurationProps) => {
  const { duration } = useContext(TestContext);

  if (duration === undefined) {
    return null;
  }

  return (
    <span
      className={cn("shrink-0 text-muted-foreground text-xs tabular-nums", className)}
      {...props}
    >
      {children ?? `${duration}ms`}
    </span>
  );
};

export type TestStatusProps = HTMLAttributes<HTMLSpanElement>;

export const TestStatus = ({ className, children, ...props }: TestStatusProps) => {
  const { status } = useContext(TestContext);

  return (
    <span className={cn("shrink-0", className)} {...props}>
      {children ?? <StatusIcon status={testStatusToCanonical[status]} />}
    </span>
  );
};

export type TestProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  status: TestStatus;
  duration?: number;
};

/**
 * Test — a single test-case row. `ps-10` aligns the status icon with the
 * suite's status icon (after the trigger's chevron + gap), giving a clean
 * left-column across the expansion.
 */
export const Test = ({ name, status, duration, className, children, ...props }: TestProps) => {
  const contextValue = useMemo(() => ({ duration, name, status }), [duration, name, status]);

  return (
    <TestContext.Provider value={contextValue}>
      <div
        className={cn("flex min-w-0 items-center gap-2 ps-10 pe-4 py-2 text-sm", className)}
        {...props}
      >
        {children ?? (
          <>
            <TestStatus />
            <TestName />
            {duration !== undefined && <TestDuration />}
          </>
        )}
      </div>
    </TestContext.Provider>
  );
};

export type TestErrorProps = HTMLAttributes<HTMLDivElement>;

export const TestError = ({ className, children, ...props }: TestErrorProps) => (
  <div className={cn("rounded-md bg-destructive/10 p-3", className)} {...props}>
    {children}
  </div>
);

export type TestErrorMessageProps = HTMLAttributes<HTMLParagraphElement>;

export const TestErrorMessage = ({ className, children, ...props }: TestErrorMessageProps) => (
  <p className={cn("font-medium text-destructive-text text-sm", className)} {...props}>
    {children}
  </p>
);

export type TestErrorStackProps = HTMLAttributes<HTMLPreElement>;

export const TestErrorStack = ({ className, children, ...props }: TestErrorStackProps) => (
  <pre
    className={cn("mt-2 overflow-auto font-mono text-destructive-text text-xs", className)}
    {...props}
  >
    {children}
  </pre>
);
