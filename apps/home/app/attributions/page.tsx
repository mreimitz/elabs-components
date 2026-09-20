import type { Metadata } from "next";
import { AttributionPanel, SectionHeader } from "@elabs-ai/components-ui";
import { galleryCopy } from "../../content/copy";

export const metadata: Metadata = {
  title: galleryCopy.attributions.pageTitle,
  alternates: { canonical: "/attributions" },
};

export default function AttributionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <SectionHeader as="h1" title={galleryCopy.attributions.pageTitle} />
      <AttributionPanel />
    </div>
  );
}
