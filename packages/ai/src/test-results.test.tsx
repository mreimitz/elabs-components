import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Test,
  TestError,
  TestErrorMessage,
  TestErrorStack,
  TestResults,
  TestResultsContent,
  TestResultsDuration,
  TestResultsHeader,
  TestResultsMeta,
  TestResultsProgress,
  TestResultsSummary,
  TestSuite,
  TestSuiteContent,
  TestSuiteName,
  TestSuiteStats,
} from "./test-results";

const summary = { passed: 8, failed: 2, skipped: 1, total: 11, duration: 1240 };

describe("TestResults", () => {
  it("renders the compound tree without crashing", () => {
    render(
      <TestResults summary={summary} data-testid="results">
        <TestResultsHeader>
          <span>api.integration.test.ts</span>
          <TestResultsDuration />
        </TestResultsHeader>
        <TestResultsMeta>
          <TestResultsSummary />
          <TestResultsProgress />
        </TestResultsMeta>
        <TestResultsContent>
          <TestSuite name="auth" status="failed">
            <TestSuiteName />
            <TestSuiteContent>
              <Test name="signs a valid user in" status="passed" duration={42} />
              <Test name="rejects an expired token" status="failed" duration={88} />
              <Test name="legacy SSO path" status="skipped" />
              <Test name="enforces the rate limit" status="running" />
            </TestSuiteContent>
          </TestSuite>
        </TestResultsContent>
      </TestResults>,
    );

    expect(screen.getByTestId("results")).toBeInTheDocument();
  });

  it("renders duration from context when summary has a duration", () => {
    render(
      <TestResults summary={summary}>
        <TestResultsHeader>
          <TestResultsDuration />
        </TestResultsHeader>
      </TestResults>,
    );
    // 1240ms → "1.24s"
    expect(screen.getByText("1.24s")).toBeInTheDocument();
  });

  it("renders nothing for TestResultsDuration when duration is absent", () => {
    const { container } = render(
      <TestResults summary={{ passed: 3, failed: 0, skipped: 0, total: 3 }}>
        <TestResultsHeader>
          <TestResultsDuration />
        </TestResultsHeader>
      </TestResults>,
    );
    // No duration span rendered
    expect(container.querySelector("span")).toBeNull();
  });

  it("renders passed/failed/skipped badges in TestResultsSummary", () => {
    render(
      <TestResults summary={summary}>
        <TestResultsMeta>
          <TestResultsSummary />
        </TestResultsMeta>
      </TestResults>,
    );
    expect(screen.getByText("8 passed")).toBeInTheDocument();
    expect(screen.getByText("2 failed")).toBeInTheDocument();
    expect(screen.getByText("1 skipped")).toBeInTheDocument();
  });

  it("omits failed/skipped badges when counts are zero", () => {
    render(
      <TestResults summary={{ passed: 5, failed: 0, skipped: 0, total: 5 }}>
        <TestResultsMeta>
          <TestResultsSummary />
        </TestResultsMeta>
      </TestResults>,
    );
    expect(screen.getByText("5 passed")).toBeInTheDocument();
    expect(screen.queryByText(/failed/)).toBeNull();
    expect(screen.queryByText(/skipped/)).toBeNull();
  });

  it("renders progress bar with tabular-nums label", () => {
    render(
      <TestResults summary={summary}>
        <TestResultsMeta>
          <TestResultsProgress />
        </TestResultsMeta>
      </TestResults>,
    );
    // 8/11 = 72.727…% → "73%"
    expect(screen.getByText("8/11 tests passed")).toBeInTheDocument();
    expect(screen.getByText("73%")).toBeInTheDocument();
  });

  it("renders suite stats with correct counts", () => {
    render(
      <TestResults summary={summary}>
        <TestResultsContent>
          <TestSuite name="auth" status="failed">
            <TestSuiteName>
              auth.service
              <TestSuiteStats passed={3} failed={1} skipped={1} />
            </TestSuiteName>
          </TestSuite>
        </TestResultsContent>
      </TestResults>,
    );
    expect(screen.getByText("3 passed")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getByText("1 skipped")).toBeInTheDocument();
  });

  it("renders Test rows with name and duration (suite open)", () => {
    render(
      <TestResults summary={summary}>
        <TestResultsContent>
          <TestSuite name="auth" status="failed" defaultOpen>
            <TestSuiteContent>
              <Test name="signs a valid user in" status="passed" duration={42} />
            </TestSuiteContent>
          </TestSuite>
        </TestResultsContent>
      </TestResults>,
    );
    expect(screen.getByText("signs a valid user in")).toBeInTheDocument();
    expect(screen.getByText("42ms")).toBeInTheDocument();
  });

  it("omits Test duration when not provided (suite open)", () => {
    render(
      <TestResults summary={summary}>
        <TestResultsContent>
          <TestSuite name="auth" status="failed" defaultOpen>
            <TestSuiteContent>
              <Test name="legacy SSO path" status="skipped" />
            </TestSuiteContent>
          </TestSuite>
        </TestResultsContent>
      </TestResults>,
    );
    expect(screen.queryByText(/ms/)).toBeNull();
  });

  it("renders TestError with message and stack (suite open)", () => {
    render(
      <TestResults summary={summary}>
        <TestResultsContent>
          <TestSuite name="auth" status="failed" defaultOpen>
            <TestSuiteContent>
              <Test name="rejects an expired token" status="failed" duration={88} />
              <div className="px-4 py-2">
                <TestError>
                  <TestErrorMessage>Expected status 401 but received 200</TestErrorMessage>
                  <TestErrorStack>{"at verify (auth.service.test.ts:14:9)"}</TestErrorStack>
                </TestError>
              </div>
            </TestSuiteContent>
          </TestSuite>
        </TestResultsContent>
      </TestResults>,
    );
    expect(screen.getByText("Expected status 401 but received 200")).toBeInTheDocument();
    expect(screen.getByText("at verify (auth.service.test.ts:14:9)")).toBeInTheDocument();
  });

  it("renders the minimal auto path when only summary is passed", () => {
    render(<TestResults summary={summary} data-testid="min" />);
    // Auto-render produces the header with badges + duration
    expect(screen.getByTestId("min")).toBeInTheDocument();
  });

  it("TestResultsMeta applies consistent padding class", () => {
    const { container } = render(
      <TestResults summary={summary}>
        <TestResultsMeta data-testid="meta">
          <TestResultsSummary />
        </TestResultsMeta>
      </TestResults>,
    );
    const meta = container.querySelector("[data-testid='meta']");
    expect(meta?.className).toContain("px-4");
    expect(meta?.className).toContain("pb-4");
    expect(meta?.className).toContain("pt-3");
  });

  it("TestResultsContent uses divide-y (no nested border boxes)", () => {
    const { container } = render(
      <TestResults summary={summary}>
        <TestResultsContent data-testid="content">
          <TestSuite name="s1" status="passed">
            <TestSuiteName />
          </TestSuite>
        </TestResultsContent>
      </TestResults>,
    );
    const content = container.querySelector("[data-testid='content']");
    expect(content?.className).toContain("divide-y");
    // TestSuite must NOT have a border class of its own (no nested box)
    const suite = content?.querySelector("[data-radix-collapsible-root]") as HTMLElement | null;
    if (suite) {
      expect(suite.className).not.toMatch(/\bborder\b/);
      expect(suite.className).not.toContain("rounded-lg");
    }
  });

  it("Test rows use ps-10 for hierarchical indent alignment (suite open)", () => {
    render(
      <TestResults summary={summary}>
        <TestResultsContent>
          <TestSuite name="auth" status="failed" defaultOpen>
            <TestSuiteContent>
              <Test name="signs a valid user in" status="passed" data-testid="testrow" />
            </TestSuiteContent>
          </TestSuite>
        </TestResultsContent>
      </TestResults>,
    );
    const row = screen.getByTestId("testrow");
    expect(row.className).toContain("ps-10");
  });
});
