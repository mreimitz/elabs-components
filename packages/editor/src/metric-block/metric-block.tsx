/**
 * MetricBlock — thin alias for the canonical `@elabs-ai/components-ui` MetricCard.
 *
 * Previously a fork that added `description` + avoided an editor→charts sideways
 * dep. Now that MetricCard lives in `@elabs-ai/components-ui` (which @elabs-ai/components-editor already depends
 * on), this wrapper preserves the `MetricBlock` / `MetricBlockProps` public names so
 * `directive-views.tsx` and `markdown/index.ts` keep working unchanged.
 *
 * ADR: docs/ADR/0012-metric-card-canonical-home.md
 */
import { MetricCard, type MetricCardProps } from "@elabs-ai/components-ui";

export type MetricBlockProps = MetricCardProps;
export const MetricBlock = MetricCard;
