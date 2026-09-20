"use client";

import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  SectionHeader,
} from "@elabs-ai/components-ui";

export interface FaqItem {
  question: string;
  answer: ReactNode;
}

export interface MarketingFaqProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  items?: FaqItem[];
  contactHref?: string;
}

const DEFAULT_ITEMS: FaqItem[] = [
  {
    question: "How long does it take to go live?",
    answer:
      "A single depot is usually planning live routes within a week. A network with customs and single sign-on takes four to six weeks, most of it your own data clean-up.",
  },
  {
    question: "Do drivers need new phones?",
    answer:
      "No. The app runs on any Android or iOS phone from the last five years and works offline in the yard.",
  },
  {
    question: "Can we keep our carriers and our rate cards?",
    answer:
      "Yes. You bring your carriers, lanes and rates; we import them and keep them in sync with your ERP.",
  },
  {
    question: "Where is our data stored?",
    answer:
      "In the region you choose at sign-up — EU, US or APAC — and it stays there. Enterprise plans can pin a single country.",
  },
  {
    question: "What happens after the trial?",
    answer:
      "You pick a plan or the workspace goes read-only. Nothing is deleted for 60 days, and you can export everything at any time.",
  },
];

/** Questions before buying — an accordion, plus a person to ask when the answer is not there. */
export function MarketingFaq({
  eyebrow = "Questions",
  title = "What people ask before they start",
  items = DEFAULT_ITEMS,
  contactHref = "#contact",
}: MarketingFaqProps) {
  return (
    <section className="@container mx-auto w-full max-w-7xl px-4 py-16" data-slot="marketing-faq">
      <div className="grid grid-cols-1 gap-10 @4xl:grid-cols-3">
        <div className="flex flex-col gap-6">
          <SectionHeader as="h2" eyebrow={eyebrow} title={title} />
          <div className="flex flex-col items-start gap-3">
            <p className="text-body text-muted-foreground">
              Not here? A person answers within one business day.
            </p>
            <Button asChild variant="outline">
              <a href={contactHref}>Ask us directly</a>
            </Button>
          </div>
        </div>
        <Accordion className="@4xl:col-span-2" collapsible defaultValue="faq-0" type="single">
          {items.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
