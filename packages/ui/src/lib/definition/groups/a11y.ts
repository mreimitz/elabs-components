/**
 * a11y group — the accessible name and description a component exposes to
 * assistive technology when its visible text does not say enough.
 *
 * React-free.
 */

import { field } from "../field";
import { definePropGroup } from "../prop-group";

export interface A11yGroupProps {
  accessibleLabel?: string;
  accessibleDescription?: string;
}

export const a11yGroup = /* @__PURE__ */ definePropGroup<A11yGroupProps>()({
  id: "a11y",
  fields: {
    accessibleLabel: field.string({
      tier: "advanced",
      description: "Accessible name, when the visible title is missing or not enough.",
    }),
    accessibleDescription: field.string({
      tier: "advanced",
      description: "Accessible description read after the name.",
    }),
  },
});
