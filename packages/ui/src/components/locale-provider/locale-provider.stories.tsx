import type { Meta, StoryObj } from "@storybook/react-vite";
import { LocaleProvider, useLocale } from "./locale-provider";

const meta = {
  title: "Providers/LocaleProvider",
  component: LocaleProvider,
  tags: ["autodocs"],
} satisfies Meta<typeof LocaleProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Demo component: reads the active locale context
// ---------------------------------------------------------------------------

function LocaleDemo() {
  const { locale, dir, t, formatNumber, formatDate } = useLocale();
  return (
    <div className="space-y-2 rounded-md border border-border p-4 text-body">
      <p>
        <span className="font-medium text-muted-foreground">locale: </span>
        {locale}
      </p>
      <p>
        <span className="font-medium text-muted-foreground">dir: </span>
        {dir}
      </p>
      <p>
        <span className="font-medium text-muted-foreground">t(&quot;next&quot;): </span>
        {t("next")}
      </p>
      <p>
        <span className="font-medium text-muted-foreground">t(&quot;previous&quot;): </span>
        {t("previous")}
      </p>
      <p>
        <span className="font-medium text-muted-foreground">t(&quot;close&quot;): </span>
        {t("close")}
      </p>
      <p>
        <span className="font-medium text-muted-foreground">
          formatNumber(1234567.89, currency EUR):{" "}
        </span>
        {formatNumber(1234567.89, { style: "currency", currency: "EUR" })}
      </p>
      <p>
        <span className="font-medium text-muted-foreground">formatDate(2026-06-08): </span>
        {formatDate(new Date(2026, 5, 8))}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** English (en-US) locale — the default. */
export const Default: Story = {
  render: () => (
    <LocaleProvider locale="en-US" dir="ltr">
      <LocaleDemo />
    </LocaleProvider>
  ),
};

/**
 * Arabic (ar-EG) locale with RTL direction.
 * Overrides `next` and `previous` keys; other keys fall back to the English defaults.
 */
export const RtlArabic: Story = {
  render: () => (
    <LocaleProvider locale="ar-EG" dir="rtl" messages={{ next: "التالي", previous: "السابق" }}>
      <LocaleDemo />
    </LocaleProvider>
  ),
};

/** Without a provider — `useLocale` degrades to en-US / ltr defaults. */
export const NoProvider: Story = {
  render: () => <LocaleDemo />,
};
