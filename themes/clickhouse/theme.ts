import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

/** The "ClickHouse" theme family — register on <ThemeProvider themes={…}>. */
export const clickhouseThemes: ThemeDefinition[] = [
  defineTheme({
    value: "clickhouse-light",
    label: "ClickHouse Light",
    dark: false,
    family: "clickhouse",
    familyLabel: "ClickHouse",
  }),
  defineTheme({
    value: "clickhouse-dark",
    label: "ClickHouse Dark",
    dark: true,
    family: "clickhouse",
  }),
];
