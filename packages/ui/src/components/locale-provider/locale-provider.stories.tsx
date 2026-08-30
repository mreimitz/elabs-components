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
// Demo component: cardinal-plural microcopy via `Intl.PluralRules`
// ---------------------------------------------------------------------------

function PluralDemo() {
  const { t } = useLocale();
  return (
    <div className="space-y-1 rounded-md border border-border p-4 text-body">
      {[0, 1, 2, 5].map((count) => (
        <p key={count}>
          <span className="font-medium text-muted-foreground">count={count}: </span>
          {t("itemsSelected", { count })}
        </p>
      ))}
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

/**
 * The `translate` resolver bridge (#19) — stands in for an app's own i18n
 * runtime (next-intl, react-intl, i18next, …). It takes precedence over both
 * `messages` and the shipped English defaults; returning `undefined` for a
 * key falls through to the normal chain. See `docs/I18N.md` for a worked
 * next-intl example.
 */
export const ExternalTranslateResolver: Story = {
  render: () => (
    <LocaleProvider
      locale="de-DE"
      messages={{ close: "Schließen (via messages)" }}
      translate={(key) => (key === "close" ? "Schließen (via translate)" : undefined)}
    >
      <LocaleDemo />
    </LocaleProvider>
  ),
};

/**
 * Cardinal-plural microcopy (#19) — `t("itemsSelected", { count })` selects
 * the right English form ("1 item selected" vs "N items selected") from a
 * `PluralMessage` map as `count` changes, via `Intl.PluralRules`.
 */
export const PluralForms: Story = {
  render: () => (
    <LocaleProvider locale="en-US">
      <PluralDemo />
    </LocaleProvider>
  ),
};

/**
 * The same plural key resolved for Polish (`pl-PL`), which has FOUR cardinal
 * categories (one/few/many/other) with different count boundaries than
 * English's two (one/other) — the case a plural design that only handles
 * English silently gets wrong. Count 1 → "one", 2 → "few", 5 → "many".
 */
export const PluralFormsPolish: Story = {
  render: () => (
    <LocaleProvider
      locale="pl-PL"
      messages={{
        itemsSelected: {
          one: "{count} plik zaznaczony",
          few: "{count} pliki zaznaczone",
          many: "{count} plików zaznaczonych",
          other: "{count} pliku zaznaczonego",
        },
      }}
    >
      <PluralDemo />
    </LocaleProvider>
  ),
};
