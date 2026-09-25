/**
 * header group — the text that names and introduces a component: a title,
 * an optional subtitle and a longer description. Shared by chart containers,
 * flow nodes and cards. A kind whose title is required re-declares `title`
 * as an own field with `required: true`.
 *
 * React-free.
 */

import { field } from "../field";
import { definePropGroup } from "../prop-group";

export interface HeaderGroupProps {
  title?: string;
  subtitle?: string;
  description?: string;
}

export const headerGroup = /* @__PURE__ */ definePropGroup<HeaderGroupProps>()({
  id: "header",
  fields: {
    title: field.string({ tier: "essential", description: "Primary label." }),
    subtitle: field.string({ tier: "advanced", description: "Secondary line under the title." }),
    description: field.string({ tier: "advanced", description: "Longer supporting text." }),
  },
});
