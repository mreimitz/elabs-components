/**
 * ModelProviderLogo — the mark of an AI model provider, sized for a list row.
 *
 * It fetches provider marks from a **remote origin**
 * (`models.dev`) by default, so a restrictive `img-src` blocks them. Pass `src`
 * to self-host, or `fallback` to control what a blocked load renders — it is
 * never a broken-image glyph. See `docs/CSP-AND-NETWORK.md`.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ModelProviderLogo } from "./model-provider-logo";

const meta = {
  title: "AI/ModelProviderLogo",
  component: ModelProviderLogo,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The mark of an AI model provider, sized for a row in a model list. Defaults to " +
          "fetching from models.dev; pass `src` for a self-hosted asset and `fallback` for the " +
          "blocked/offline case. A failed load renders a neutral glyph, never a broken image.\n\n" +
          "**`ModelProviderLogo` vs `ServiceLogo` (`@elabs-ai/components-icons`).** An AI " +
          "provider mark with a zero-config remote default → this component. Any other " +
          "third-party service mark, resolved from a registry the app supplies and never " +
          "fetched → `ServiceLogo`.\n\n" +
          "For the list this logo sits in: an inline pill in a composer footer → `ModelPicker` " +
          "(`@elabs-ai/components-ui`); a full ⌘K palette → compose `CommandDialog` + " +
          "`Command*` from `@elabs-ai/components-ui` directly.",
      },
    },
  },
  args: { provider: "anthropic" },
  tags: ["autodocs"],
} satisfies Meta<typeof ModelProviderLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The blocked / offline state — the DEFAULT story on purpose, so neither CI nor
 * the visual sweep depends on a third-party origin. `src` cannot resolve, so the
 * neutral fallback glyph renders.
 */
export const Default: Story = {
  args: { src: "about:blank#logo-offline" },
};

/** A caller-supplied fallback instead of the built-in glyph. */
export const CustomFallback: Story = {
  args: {
    src: "about:blank#logo-offline",
    fallback: <span className="text-meta text-muted-foreground">AI</span>,
  },
};

/** A self-hosted (inline data-URI) logo — the CSP-safe path. */
export const SelfHosted: Story = {
  args: {
    src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Ccircle cx='6' cy='6' r='5' fill='%23888'/%3E%3C/svg%3E",
  },
};

/**
 * Live logos from the default remote origin.
 *
 * ⚠️ The only story here that reaches the network (`models.dev`). Each falls
 * back to the neutral glyph if blocked.
 */
export const LiveRemoteLogos: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {(["anthropic", "openai", "google", "mistral"] as const).map((provider) => (
        <figure className="flex flex-col items-center gap-2" key={provider}>
          <ModelProviderLogo provider={provider} />
          <figcaption className="text-meta text-muted-foreground">{provider}</figcaption>
        </figure>
      ))}
    </div>
  ),
};
