"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Braces, FlaskConical, type LucideIcon, ShieldCheck } from "lucide-react";
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  type CodeBlockProps,
  CodeBlockTitle,
} from "@elabs-ai/components-ai";
import {
  Badge,
  Button,
  CommandChip,
  type CommandChipHost,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@elabs-ai/components-ui";

export interface CodeExampleSnippet {
  id: string;
  /** Tab label. */
  label: string;
  /** Shown in the code block header, e.g. a file name or the shell. */
  filename: string;
  language: CodeBlockProps["language"];
  code: string;
}

export interface CodeExampleFact {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface MarketingCodeExampleProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** The install command per package manager, shown as a copyable chip. */
  installHosts?: CommandChipHost[];
  /** One tab per language; the first is selected. */
  snippets?: CodeExampleSnippet[];
  /** Three reasons developers pick it, under the headline. */
  facts?: CodeExampleFact[];
  /** Caption under the code — what the snippet does when run. */
  resultNote?: ReactNode;
  /**
   * The heading level of the title. `"h1"` when this block is the page's hero (the
   * default); `"h2"` when it sits under a page that already has its `<h1>`.
   */
  titleAs?: "h1" | "h2";
}

const DEFAULT_INSTALL_HOSTS: CommandChipHost[] = [
  { id: "npm", label: "npm", command: "npm install @relay/sdk" },
  { id: "pnpm", label: "pnpm", command: "pnpm add @relay/sdk" },
  { id: "yarn", label: "yarn", command: "yarn add @relay/sdk" },
  { id: "pip", label: "pip", command: "pip install relay-sdk" },
];

const DEFAULT_SNIPPETS: CodeExampleSnippet[] = [
  {
    id: "curl",
    label: "curl",
    filename: "terminal",
    language: "bash",
    code: `curl https://api.relay.example/v1/events \\
  -H "Authorization: Bearer rl_test_4f2a…" \\
  -H "Idempotency-Key: order-10482-paid" \\
  -d '{
    "type": "order.paid",
    "payload": { "order_id": "10482", "amount": 12900, "currency": "EUR" }
  }'`,
  },
  {
    id: "typescript",
    label: "TypeScript",
    filename: "events.ts",
    language: "typescript",
    code: `import { Relay } from "@relay/sdk";

const relay = new Relay({ apiKey: process.env.RELAY_API_KEY });

const event = await relay.events.publish({
  type: "order.paid",
  payload: { orderId: "10482", amount: 12900, currency: "EUR" },
  idempotencyKey: "order-10482-paid",
});

console.log(event.id); // evt_01J9… delivered to 3 subscribers`,
  },
  {
    id: "python",
    label: "Python",
    filename: "events.py",
    language: "python",
    code: `from relay import Relay

relay = Relay(api_key=os.environ["RELAY_API_KEY"])

event = relay.events.publish(
    type="order.paid",
    payload={"order_id": "10482", "amount": 12900, "currency": "EUR"},
    idempotency_key="order-10482-paid",
)

print(event.id)  # evt_01J9… delivered to 3 subscribers`,
  },
];

const DEFAULT_FACTS: CodeExampleFact[] = [
  {
    icon: Braces,
    title: "Typed SDKs, generated from the spec",
    body: "TypeScript, Python, Go and Java clients ship the same day the API changes. Your editor knows every field.",
  },
  {
    icon: ShieldCheck,
    title: "99.99% API uptime, in writing",
    body: "Eleven quarters without a missed SLA. The status page is public and the credits are automatic.",
  },
  {
    icon: FlaskConical,
    title: "A sandbox with real failures",
    body: "Test keys replay retries, timeouts and out-of-order delivery so the first outage you see is a fake one.",
  },
];

/**
 * A developer hero — the pitch on one side, the actual code on the other. Three language
 * tabs over a highlighted, copyable block; an install chip that switches package manager;
 * and three reasons to pick it that a developer can check, not slogans.
 */
export function MarketingCodeExample({
  eyebrow = "Relay events API",
  title = "Publish an event. Every subscriber gets it, exactly once.",
  description = "Relay is the delivery layer between your services and everyone who needs to know. One call publishes; retries, ordering, signatures and the audit trail are ours.",
  primaryCta = { label: "Get an API key", href: "#register" },
  secondaryCta = { label: "Read the reference", href: "#docs" },
  installHosts = DEFAULT_INSTALL_HOSTS,
  snippets = DEFAULT_SNIPPETS,
  facts = DEFAULT_FACTS,
  resultNote = "Runs against the sandbox with a test key. Nothing is billed and every delivery shows up in the dashboard within a second.",
  titleAs: TitleTag = "h1",
}: MarketingCodeExampleProps) {
  const [snippet, setSnippet] = useState(snippets[0]?.id ?? "");

  return (
    <section
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16"
      data-slot="marketing-code-example"
    >
      <div className="grid grid-cols-1 items-center gap-10 @4xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @4xl:gap-14">
        <div className="flex flex-col gap-6" data-slot="marketing-code-example-copy">
          <div className="flex flex-col gap-4">
            <Badge className="w-fit" variant="outline">
              {eyebrow}
            </Badge>
            <TitleTag className="text-display font-semibold text-balance">{title}</TitleTag>
            <p className="text-subtitle text-muted-foreground text-pretty">{description}</p>
          </div>
          <CommandChip
            aria-label="Install the SDK"
            className="w-fit max-w-full"
            data-slot="marketing-code-example-install"
            hosts={installHosts}
          />
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={primaryCta.href}>
                {primaryCta.label}
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={secondaryCta.href}>{secondaryCta.label}</a>
            </Button>
          </div>
        </div>

        <Tabs
          className="flex min-w-0 flex-col gap-3"
          data-slot="marketing-code-example-snippets"
          onValueChange={setSnippet}
          value={snippet}
        >
          <TabsList aria-label="Language" className="w-fit">
            {snippets.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {snippets.map((item) => (
            <TabsContent className="min-w-0" key={item.id} value={item.id}>
              <CodeBlock
                className="shadow-md"
                code={item.code}
                language={item.language}
                showLineNumbers
                wrap
              >
                <CodeBlockHeader>
                  <CodeBlockTitle>
                    <CodeBlockFilename>{item.filename}</CodeBlockFilename>
                  </CodeBlockTitle>
                  <CodeBlockCopyButton />
                </CodeBlockHeader>
              </CodeBlock>
            </TabsContent>
          ))}
          <p className="text-caption text-muted-foreground text-pretty">{resultNote}</p>
        </Tabs>
      </div>

      <ul
        className="grid grid-cols-1 gap-6 border-t border-border pt-10 @2xl:grid-cols-3"
        data-slot="marketing-code-example-facts"
      >
        {facts.map((fact) => {
          const Icon = fact.icon;
          return (
            <li className="flex gap-3" key={fact.title}>
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
              >
                <Icon className="size-4.5" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-body font-semibold">{fact.title}</h2>
                <p className="text-caption text-muted-foreground text-pretty">{fact.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
