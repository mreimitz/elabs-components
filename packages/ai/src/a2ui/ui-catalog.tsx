"use client";

/**
 * ui-catalog.tsx — the shipped A2UI catalog: every non-builtin type in
 * `catalog.source.json` bound to its `@elabs-ai/components-ui` component. The
 * schema half (`A2UI_CATALOG_SCHEMA`, generated) says what an agent MAY emit; this
 * half says what it renders AS. A test asserts the two key sets are identical, so
 * a type cannot be validatable-but-unrenderable or the reverse.
 *
 * Apps extend it (`createA2uiCatalog`) with their own types — a chart from
 * `@elabs-ai/components-charts`, a domain card — because `ai` may not import its
 * sibling packages (one-way dependency graph) and an app composes freely.
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  BentoGrid,
  BentoGridItem,
  Button,
  ButtonGroup,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Descriptions,
  DescriptionsItem,
  EmptyState,
  Heading,
  Input,
  Kbd,
  Label,
  MetricCard,
  Progress,
  RadioGroup,
  RadioGroupItem,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  StatePanel,
  StatusBadge,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  Textarea,
  Timeline,
} from "@elabs-ai/components-ui";
import type { ComponentType } from "react";

import { A2UI_CATALOG_SCHEMA } from "./core/catalog.generated";
import type { A2uiCatalogSchema, A2uiCatalogTypeSchema } from "./core/spec";

/** One renderable catalog type: its schema plus the component that draws it. */
export interface A2uiCatalogEntry {
  schema: A2uiCatalogTypeSchema;
  /** Absent for builtins (`Stack`, `Grid`), which the surface draws itself. */
  component?: ComponentType<Record<string, unknown>>;
}

export type A2uiCatalog = Record<string, A2uiCatalogEntry>;

// `ComponentType<Record<string, unknown>>` is the erased shape the renderer calls
// with validated, catalog-shaped props; each binding is a real ui component.
type AnyComponent = ComponentType<any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- erased at the catalog boundary; props are validated against the schema

/** The `@elabs-ai/components-ui` bindings, one per non-builtin catalog type. */
export const UI_CATALOG_BINDINGS: Record<string, AnyComponent> = {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  BentoGrid,
  BentoGridItem,
  Button,
  ButtonGroup,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Descriptions,
  DescriptionsItem,
  EmptyState,
  Heading,
  Input,
  Kbd,
  Label,
  MetricCard,
  Progress,
  RadioGroup,
  RadioGroupItem,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  StatePanel,
  StatusBadge,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  Textarea,
  Timeline,
};

/**
 * Build a catalog from component bindings + a schema. Every schema type that is
 * not a builtin must have a binding; a binding without a schema is ignored (it
 * would be unvalidatable). Extend the shipped one:
 *
 * ```ts
 * const catalog = createA2uiCatalog(
 *   { ...UI_CATALOG_BINDINGS, RevenueChart },
 *   { ...A2UI_CATALOG_SCHEMA, RevenueChart: defineA2uiType({ props: { series: { type: "array", required: true } } }) },
 * );
 * ```
 */
export function createA2uiCatalog(
  bindings: Record<string, AnyComponent>,
  schema: A2uiCatalogSchema = A2UI_CATALOG_SCHEMA,
): A2uiCatalog {
  const catalog: A2uiCatalog = {};
  for (const [type, typeSchema] of Object.entries(schema)) {
    if (typeSchema.builtin) {
      catalog[type] = { schema: typeSchema };
      continue;
    }
    const component = bindings[type];
    if (!component) {
      throw new Error(`createA2uiCatalog: catalog type "${type}" has no component binding`);
    }
    catalog[type] = { schema: typeSchema, component };
  }
  return catalog;
}

/** Author a schema entry for an app-provided type with sensible defaults. */
export function defineA2uiType(
  partial: Partial<A2uiCatalogTypeSchema> & { source?: string },
): A2uiCatalogTypeSchema {
  return {
    children: partial.children ?? false,
    props: partial.props ?? {},
    events: partial.events ?? {},
    source: partial.source ?? "app",
    ...(partial.summary ? { summary: partial.summary } : {}),
    ...(partial.builtin ? { builtin: true } : {}),
  };
}

/** The schema half of a catalog (what `validateA2uiSurface` takes). */
export function catalogSchema(catalog: A2uiCatalog): A2uiCatalogSchema {
  return Object.fromEntries(Object.entries(catalog).map(([t, e]) => [t, e.schema]));
}

/** The shipped catalog: builtins + every `@elabs-ai/components-ui` type above. */
export const uiCatalog: A2uiCatalog = createA2uiCatalog(UI_CATALOG_BINDINGS);
