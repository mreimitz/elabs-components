import type { Metadata } from "next";
import { SectionHeader } from "@elabs-ai/components-ui";
import { GatesBand } from "@elabs-ai/components-marketing";
import { AgentLoopSection } from "../../components/agent-loop/agent-loop-section";
import { EmitUiSection } from "../../components/agent-loop/emit-ui";
import { WorksWith } from "../../components/agents/works-with";
import { countFor, gates } from "../../lib/content";
import { galleryCopy, gatesBandCopy, shellCopy } from "../../content/copy";
import { Band } from "../../components/band";
import { PageBand } from "../../components/page-band";

const copy = galleryCopy.agents;

export const metadata: Metadata = {
  title: copy.pageTitle,
  description: copy.pageDescription,
  alternates: { canonical: "/agents" },
};

// Everything the home page says about agents in one section, at full length: the live tool-call
// trace (with the D5 scope line under it), the generative-UI editor, the install matrix, and the
// complete gate catalogue.
export default function AgentsPage() {
  return (
    <div className="flex w-full flex-col">
      <PageBand width="7xl">
        <SectionHeader
          as="h1"
          size="lg"
          title={copy.pageTitle}
          description={copy.pageDescription}
        />
      </PageBand>
      <Band>
        <AgentLoopSection />
      </Band>
      <Band>
        <EmitUiSection />
      </Band>
      <Band>
        <WorksWith />
      </Band>
      <Band>
        <section id="gates" className="mx-auto w-full max-w-7xl px-6 py-16">
          <GatesBand
            gates={gates}
            count={countFor("gates").value}
            categoryLabels={gatesBandCopy.categoryLabels}
            footer={
              <>
                {gatesBandCopy.footerPrefix}{" "}
                <a
                  className="underline underline-offset-2 focus-ring"
                  href={`${shellCopy.links.github}/blob/main/docs/GATES.md`}
                >
                  {gatesBandCopy.footerLinkText}
                </a>{" "}
                {gatesBandCopy.footerSuffix}
              </>
            }
          />
        </section>
      </Band>
    </div>
  );
}
