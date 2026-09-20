import type { Metadata } from "next";
import { AttributionPanel, SectionHeader } from "@elabs-ai/components-ui";
import { galleryCopy } from "../../content/copy";
import { PageBand } from "../../components/page-band";
import { Band } from "../../components/band";

export const metadata: Metadata = {
  title: galleryCopy.attributions.pageTitle,
  alternates: { canonical: "/attributions" },
};

export default function AttributionsPage() {
  return (
    <>
      <PageBand width="4xl">
        <SectionHeader as="h1" title={galleryCopy.attributions.pageTitle} />
      </PageBand>
      <Band width="4xl">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
          <AttributionPanel />
        </div>
      </Band>
    </>
  );
}
