/**
 * status group — the tone a component reports (`neutral`, `info`, `success`,
 * `warning`, `destructive`), from the same closed set as `StatusBadge`.
 * Shared by flow nodes and other status-bearing surfaces.
 *
 * **Never applied to chart containers.** On a chart, `status` is the loading
 * alias (`"loading" | "ready"`, the conventions' loading-state alias), a
 * different prop with the same name; a chart definition must not list this
 * group.
 *
 * React-free.
 */

import { STATUS_TONES, type StatusTone } from "../../status-tone";
import { field } from "../field";
import { definePropGroup } from "../prop-group";

export interface StatusGroupProps {
  status?: StatusTone;
}

export const statusGroup = /* @__PURE__ */ definePropGroup<StatusGroupProps>()({
  id: "status",
  fields: {
    status: field.enum({
      values: STATUS_TONES,
      tier: "essential",
      description: "Tone of the component's current state.",
    }),
  },
});
