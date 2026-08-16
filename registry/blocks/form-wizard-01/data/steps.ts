import type { WizardStepMeta } from "@elabs-ai/components-ui";

export const STEPS: WizardStepMeta[] = [
  { id: "customer", title: "Customer", description: "Contact details" },
  { id: "shipping", title: "Shipping", description: "Delivery address" },
  { id: "payment", title: "Payment", description: "Card details" },
  { id: "review", title: "Review", description: "Confirm & place" },
];
