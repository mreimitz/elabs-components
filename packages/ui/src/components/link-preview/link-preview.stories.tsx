import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { LinkPreviewCard } from "./link-preview";

const meta = {
  title: "Core/LinkPreviewCard",
  component: LinkPreviewCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    title: {
      description: "Page title — the primary text, 1–2 lines.",
      control: "text",
      table: { category: "Content" },
    },
    description: {
      description: "Short description / Open-Graph description. Omit for title+domain only.",
      control: "text",
      table: { category: "Content" },
    },
    image: {
      description:
        'Absolute URL of the thumbnail image (consumer-provided; decorative, alt is always "").',
      control: "text",
      table: { category: "Content" },
    },
    domain: {
      description: 'Domain label shown with the globe icon, e.g. `"github.com"`.',
      control: "text",
      table: { category: "Content" },
    },
    href: {
      description: "When set, the card becomes a keyboard-focusable stretched link.",
      control: "text",
      table: { category: "Behavior" },
    },
    loading: {
      description: 'Render skeleton placeholders — sets `aria-busy="true"`.',
      control: "boolean",
      table: { category: "State" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof LinkPreviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Loaded — full state (title + description + thumbnail + domain + href)
// ---------------------------------------------------------------------------

export const Default: Story = {
  render: () => (
    <LinkPreviewCard
      className="w-96"
      title="React documentation – Quick start"
      description="Learn the basics of React: components, props, state, and how they fit together to build interactive UIs."
      domain="react.dev"
      image="https://react.dev/images/og-learn.png"
      href="https://react.dev/learn"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Link is present and has the right href
    const link = canvas.getByRole("link", { name: /react documentation/i });
    await expect(link).toBeInTheDocument();
    await expect(link).toHaveAttribute("href", "https://react.dev/learn");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // Domain text is visible
    await expect(canvas.getByText("react.dev")).toBeInTheDocument();
    // Thumbnail image is decorative (aria-hidden)
    const img = canvasElement.querySelector("img");
    await expect(img).toHaveAttribute("aria-hidden", "true");
    await expect(img).toHaveAttribute("alt", "");
  },
};

// ---------------------------------------------------------------------------
// No image — title + description + domain, thumbnail area absent
// ---------------------------------------------------------------------------

export const NoImage: Story = {
  render: () => (
    <LinkPreviewCard
      className="w-96"
      title="GitHub – elabs/elabs-components"
      description="Source-owned, token-driven React component system for internal apps and prototypes."
      domain="github.com"
      href="https://github.com/elabs/elabs-components"
    />
  ),
  play: async ({ canvasElement }) => {
    // No <img> element rendered when image prop is absent
    const img = canvasElement.querySelector("img");
    await expect(img).toBeNull();
  },
};

// ---------------------------------------------------------------------------
// Title + domain only — no description
// ---------------------------------------------------------------------------

export const TitleAndDomainOnly: Story = {
  render: () => (
    <LinkPreviewCard
      className="w-96"
      title="Tailwind CSS – Utility-first CSS framework"
      domain="tailwindcss.com"
      href="https://tailwindcss.com"
    />
  ),
};

// ---------------------------------------------------------------------------
// Loading — skeleton state
// ---------------------------------------------------------------------------

export const Loading: Story = {
  render: () => <LinkPreviewCard className="w-96" loading />,
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector("[aria-busy]");
    await expect(card).toHaveAttribute("aria-busy", "true");
    // No real content rendered while loading
    const link = canvasElement.querySelector("a");
    await expect(link).toBeNull();
  },
};

// ---------------------------------------------------------------------------
// No href — static / non-interactive card
// ---------------------------------------------------------------------------

export const Static: Story = {
  render: () => (
    <LinkPreviewCard
      className="w-96"
      title="MDN Web Docs – HTML: HyperText Markup Language"
      description="HTML is the standard markup language for Web pages. With HTML you can create your own Website."
      domain="developer.mozilla.org"
      image="https://developer.mozilla.org/mdn-social-share.png"
    />
  ),
  play: async ({ canvasElement }) => {
    // Static card: no <a> link present
    const link = canvasElement.querySelector("a");
    await expect(link).toBeNull();
  },
};

// ---------------------------------------------------------------------------
// Empty / minimal — no props except className: degrades gracefully
// ---------------------------------------------------------------------------

export const Empty: Story = {
  render: () => <LinkPreviewCard className="w-96" />,
};

// ---------------------------------------------------------------------------
// Long content — line-clamp kicks in, no overflow
// ---------------------------------------------------------------------------

export const LongContent: Story = {
  render: () => (
    <LinkPreviewCard
      className="w-96"
      title="This is a very long page title that will wrap across multiple lines and should be clamped after two lines to prevent the card from growing too tall in a feed or sidebar context"
      description="And here is an equally long description — the kind you might get from an overly verbose Open Graph meta tag that tries to include every detail of the page. It should be clamped at two lines."
      domain="example-with-a-very-long-subdomain.internal.enterprise.example.com"
      href="https://example.com"
    />
  ),
};
