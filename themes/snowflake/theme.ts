import { defineTheme, type ThemeDefinition } from "@elabs-ai/components-tokens";

/** The "Snowflake" theme family — register on <ThemeProvider themes={…}>. */
export const snowflakeThemes: ThemeDefinition[] = [
  defineTheme({
    value: "snowflake-light",
    label: "Snowflake Light",
    dark: false,
    family: "snowflake",
    familyLabel: "Snowflake",
  }),
  defineTheme({
    value: "snowflake-dark",
    label: "Snowflake Dark",
    dark: true,
    family: "snowflake",
  }),
];
