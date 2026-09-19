/**
 * The agents section (RM-099, concept §4.3, §5a choreography 4) — a server component: the
 * header copy and the honesty line are in the server HTML; the loop hydrates. `id="agents"`
 * is the nav's "For agents" target.
 */
import { Heading, RevealOnEnter, Text } from "@elabs-ai/components-ui";
import { agentLoopCopy as copy } from "../../content/copy";
import { AgentLoop } from "./agent-loop";

export function AgentLoopSection() {
  return (
    <RevealOnEnter
      as="section"
      id="agents"
      aria-labelledby="agents-heading"
      className="mx-auto flex w-full max-w-7xl scroll-mt-24 flex-col gap-8 px-4 py-24 sm:px-6"
    >
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow text-muted-foreground">{copy.eyebrow}</p>
        <Heading level={2} id="agents-heading">
          {copy.heading}
        </Heading>
        <Text className="text-muted-foreground">{copy.lede}</Text>
      </header>
      <AgentLoop
        honestyLine={
          <p data-slot="agent-loop-honesty" className="text-caption text-muted-foreground">
            {copy.honestyLine}{" "}
            <a
              className="focus-ring rounded-sm text-foreground underline underline-offset-4"
              href={copy.honestyLinkHref}
            >
              {copy.honestyLinkLabel}
            </a>
          </p>
        }
      />
    </RevealOnEnter>
  );
}
