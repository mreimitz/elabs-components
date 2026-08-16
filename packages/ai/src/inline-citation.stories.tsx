import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  EvidenceChip,
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationText,
} from "./inline-citation";
const meta = {
  title: "AI/InlineCitation",
  component: InlineCitation,
  parameters: { layout: "padded" },
} satisfies Meta<typeof InlineCitation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <p className="max-w-prose text-body">
      The nightly deploy succeeded
      <InlineCitation>
        <InlineCitationText> on the main branch</InlineCitationText>
        <InlineCitationCard>
          <InlineCitationCardTrigger sources={["https://ci.acme.com/run/42"]} />
          <InlineCitationCardBody>
            <div className="p-3 text-meta text-muted-foreground">
              CI run #42 — all checks passed.
            </div>
          </InlineCitationCardBody>
        </InlineCitationCard>
      </InlineCitation>
      .
    </p>
  ),
};
/**
 * Sources that are not URLs — the enterprise case.
 *
 * A warehouse table, a document id or a filing has no hostname to show, so
 * `sources` accepts an opaque string or a `{ id, label, url }` object. A bare
 * non-URL string renders verbatim; `label` wins over a hostname. Nothing here
 * has to synthesize a fake URL to satisfy the chip.
 */
export const NonUrlSources: Story = {
  render: () => (
    <p className="max-w-prose text-body">
      Q3 bookings finished 4% ahead of plan
      <InlineCitation>
        <InlineCitationText> in the EMEA segment</InlineCitationText>
        <InlineCitationCard>
          <EvidenceChip
            sources={[
              { id: "warehouse.public.bookings_q3", label: "Bookings (Q3 snapshot)" },
              "Q3 FY25 Board Deck.pdf",
              { id: "doc-4821" },
            ]}
          />
          <InlineCitationCardBody>
            <div className="p-3 text-meta text-muted-foreground">
              Internal warehouse table + the Q3 board deck. Neither has a URL.
            </div>
          </InlineCitationCardBody>
        </InlineCitationCard>
      </InlineCitation>
      .
    </p>
  ),
};

// EvidenceChip — the named green "grounded" front door (#191, research 11 §B.4).
export const Evidence: Story = {
  render: () => (
    <p className="max-w-prose text-body">
      Churn improved 0.4pp quarter-over-quarter
      <InlineCitation>
        <InlineCitationText> across enterprise accounts</InlineCitationText>
        <InlineCitationCard>
          <EvidenceChip
            sources={["https://warehouse.acme.com/q3-retention", "https://crm.acme.com/cohorts"]}
          />
          <InlineCitationCardBody>
            <div className="p-3 text-meta text-muted-foreground">
              Q3 retention cohort, refreshed nightly.
            </div>
          </InlineCitationCardBody>
        </InlineCitationCard>
      </InlineCitation>
      .
    </p>
  ),
};
