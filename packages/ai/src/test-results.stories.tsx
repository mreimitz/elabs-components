import type { Meta, StoryObj } from "@storybook/react-vite";
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

/**
 * TestResults — the status colors are semantic tokens (#157): success / destructive
 * / warning (badges + progress), success-text / destructive-text (pass/fail), and
 * muted / primary for skipped / running. Verify they read correctly in every theme,
 * especially low-chroma ones (where the old raw Tailwind palette did not adapt).
 *
 * Structure: `TestResultsHeader` (file name + duration) → `TestResultsMeta`
 * (badges + progress bar) → `TestResultsContent` (divide-y suite list) →
 * `TestSuite` (collapsible trigger + `TestSuiteContent` rows). No nested
 * rounded boxes — suites are separated by dividers; the content area uses a
 * flat `divide-y` list.
 */
const meta = {
  title: "AI/TestResults",
  component: TestResults,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof TestResults>;
export default meta;
type Story = StoryObj<typeof meta>;

const summary = { passed: 8, failed: 2, skipped: 1, total: 11, duration: 1240 };

export const Default: Story = {
  render: () => (
    <div className="max-w-xl">
      <TestResults summary={summary}>
        <TestResultsHeader>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground text-body">
            api.integration.test.ts
          </span>
          <TestResultsDuration />
        </TestResultsHeader>
        <TestResultsMeta>
          <TestResultsSummary />
          <TestResultsProgress />
        </TestResultsMeta>
        <TestResultsContent>
          <TestSuite name="auth" status="failed">
            <TestSuiteName>
              auth.service
              <TestSuiteStats passed={3} failed={1} skipped={1} />
            </TestSuiteName>
            <TestSuiteContent>
              <Test name="signs a valid user in" status="passed" duration={42} />
              <Test name="issues a refresh token" status="passed" duration={31} />
              <Test name="rejects an expired token" status="failed" duration={88} />
              <div className="px-4 py-2">
                <TestError>
                  <TestErrorMessage>Expected status 401 but received 200</TestErrorMessage>
                  <TestErrorStack>{"at verify (auth.service.test.ts:14:9)"}</TestErrorStack>
                </TestError>
              </div>
              <Test name="enforces the rate limit" status="running" />
              <Test name="legacy SSO path" status="skipped" />
            </TestSuiteContent>
          </TestSuite>
        </TestResultsContent>
      </TestResults>
    </div>
  ),
};

export const AllPassing: Story = {
  render: () => (
    <div className="max-w-xl">
      <TestResults summary={{ passed: 5, failed: 0, skipped: 0, total: 5, duration: 320 }}>
        <TestResultsHeader>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground text-body">
            utils.test.ts
          </span>
          <TestResultsDuration />
        </TestResultsHeader>
        <TestResultsMeta>
          <TestResultsSummary />
          <TestResultsProgress />
        </TestResultsMeta>
        <TestResultsContent>
          <TestSuite name="formatDate" status="passed">
            <TestSuiteName>
              formatDate
              <TestSuiteStats passed={5} />
            </TestSuiteName>
            <TestSuiteContent>
              <Test name="formats ISO strings" status="passed" duration={12} />
              <Test name="handles null gracefully" status="passed" duration={8} />
              <Test name="respects locale" status="passed" duration={14} />
              <Test name="handles leap years" status="passed" duration={9} />
              <Test name="returns empty string on invalid input" status="passed" duration={11} />
            </TestSuiteContent>
          </TestSuite>
        </TestResultsContent>
      </TestResults>
    </div>
  ),
};

export const MultipleSuites: Story = {
  render: () => (
    <div className="max-w-xl">
      <TestResults summary={{ passed: 6, failed: 1, skipped: 2, total: 9, duration: 2100 }}>
        <TestResultsHeader>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground text-body">
            payments/checkout.integration.test.ts
          </span>
          <TestResultsDuration />
        </TestResultsHeader>
        <TestResultsMeta>
          <TestResultsSummary />
          <TestResultsProgress />
        </TestResultsMeta>
        <TestResultsContent>
          <TestSuite name="CartService" status="passed">
            <TestSuiteName>
              CartService
              <TestSuiteStats passed={3} />
            </TestSuiteName>
            <TestSuiteContent>
              <Test name="adds items to cart" status="passed" duration={55} />
              <Test name="removes items from cart" status="passed" duration={43} />
              <Test name="calculates totals" status="passed" duration={61} />
            </TestSuiteContent>
          </TestSuite>
          <TestSuite name="PaymentService" status="failed">
            <TestSuiteName>
              PaymentService
              <TestSuiteStats passed={3} failed={1} skipped={2} />
            </TestSuiteName>
            <TestSuiteContent>
              <Test name="authorises a card" status="passed" duration={180} />
              <Test name="declines an expired card" status="failed" duration={95} />
              <div className="px-4 py-2">
                <TestError>
                  <TestErrorMessage>Expected decline but received 200 OK</TestErrorMessage>
                  <TestErrorStack>
                    {"at PaymentService.charge (payment.test.ts:38:5)"}
                  </TestErrorStack>
                </TestError>
              </div>
              <Test name="handles 3DS challenge" status="passed" duration={210} />
              <Test name="processes refund" status="passed" duration={145} />
              <Test name="applies discount codes" status="skipped" />
              <Test name="handles partial refund" status="skipped" />
            </TestSuiteContent>
          </TestSuite>
        </TestResultsContent>
      </TestResults>
    </div>
  ),
};

/** The minimal auto-render path: pass `summary` only, no children. */
export const SummaryOnly: Story = {
  args: {
    summary: { passed: 8, failed: 2, skipped: 1, total: 11, duration: 1240 },
    className: "max-w-xl",
  },
};
