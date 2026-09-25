import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarketingCodeExample } from "@/components/marketing-code-example-01/marketing-code-example";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: MarketingCodeExample,
  title: "Patterns/Blocks/Marketing/Code Example",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "What does the first call look like?",
      description: {
        component:
          "A developer hero that shows the code before it explains it: the pitch and the install chip on one side, three language tabs over a highlighted, copyable snippet on the other. Under it, three reasons a developer can verify — typed SDKs, a written uptime promise, a sandbox that fails on purpose. Every string and snippet is a prop, so the same layout sells any API.\n\nCopy-own it: `npx shadcn add marketing-code-example-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarketingCodeExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The same layout selling a different product: a search API with two languages and its own facts. */
export const SearchApi: Story = {
  args: {
    eyebrow: "Beacon search",
    title: "Typo-tolerant search over your catalogue in one request.",
    description:
      "Beacon indexes what you send and ranks by what people click. Synonyms, facets and merchandising rules are settings, not code.",
    primaryCta: { label: "Start indexing", href: "#register" },
    secondaryCta: { label: "See the demo store", href: "#demo" },
    installHosts: [
      { id: "npm", label: "npm", command: "npm install @beacon/search" },
      { id: "pnpm", label: "pnpm", command: "pnpm add @beacon/search" },
    ],
    snippets: [
      {
        id: "typescript",
        label: "TypeScript",
        filename: "search.ts",
        language: "typescript",
        code: `import { Beacon } from "@beacon/search";

const beacon = new Beacon({ appId: "shop-eu", apiKey: process.env.BEACON_KEY });

const { hits, facets } = await beacon.index("products").search("runing shoes", {
  facets: ["brand", "size"],
  filters: "in_stock:true AND price < 200",
});

console.log(hits[0].name); // "Trail 40 running shoe" — typo forgiven`,
      },
      {
        id: "curl",
        label: "curl",
        filename: "terminal",
        language: "bash",
        code: `curl "https://shop-eu.beacon.example/1/indexes/products/query" \\
  -H "X-Beacon-Key: bk_test_9d1c…" \\
  -d '{ "query": "runing shoes", "facets": ["brand", "size"] }'`,
      },
    ],
    resultNote:
      "Responds in about 12 ms from the nearest region. Test apps are free up to 10,000 records.",
  },
};
