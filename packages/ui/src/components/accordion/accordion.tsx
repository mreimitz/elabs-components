import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = forwardRef<
  ElementRef<typeof AccordionPrimitive.Item>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(function AccordionItem({ className, ...props }, ref) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      data-slot="accordion-item"
      className={cn("border-b", className)}
      {...props}
    />
  );
});

export interface AccordionTriggerProps extends ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Trigger
> {
  /**
   * The heading level Radix's `Accordion.Header` renders. Radix hardcodes `h3`,
   * which skips a level whenever the accordion sits directly under the page
   * `h1` — so the level is the caller's to set. Visually identical at every
   * level: the type comes from the trigger, not the heading.
   * @default 3
   */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}

export const AccordionTrigger = forwardRef<
  ElementRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(function AccordionTrigger({ className, children, headingLevel = 3, ...props }, ref) {
  const Heading = `h${headingLevel}` as const;
  return (
    <AccordionPrimitive.Header asChild>
      <Heading className="flex" data-slot="accordion-header">
        <AccordionPrimitive.Trigger
          ref={ref}
          data-slot="accordion-trigger"
          className={cn(
            "flex flex-1 items-center justify-between py-4 text-body font-medium transition-all hover:underline focus-ring [&[data-state=open]>svg]:rotate-180",
            className,
          )}
          {...props}
        >
          {children}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-base ease-standard" />
        </AccordionPrimitive.Trigger>
      </Heading>
    </AccordionPrimitive.Header>
  );
});

export const AccordionContent = forwardRef<
  ElementRef<typeof AccordionPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(function AccordionContent({ className, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      data-slot="accordion-content"
      className="overflow-hidden text-body data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("pb-4 pt-0 text-muted-foreground", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
});
