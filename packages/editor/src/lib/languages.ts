/**
 * Curated language list for the editor toolbar's language picker. Ids are
 * Monaco's built-in language ids (`monaco.languages.getLanguages()`), so they
 * map straight onto `setModelLanguage` / model creation.
 */
export interface EditorLanguage {
  /** Monaco language id (e.g. "typescript"). */
  id: string;
  /** Human-readable label for the picker. */
  label: string;
}

export const EDITOR_LANGUAGES: EditorLanguage[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "json", label: "JSON" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "scss", label: "SCSS" },
  { id: "markdown", label: "Markdown" },
  { id: "python", label: "Python" },
  { id: "sql", label: "SQL" },
  { id: "yaml", label: "YAML" },
  { id: "xml", label: "XML" },
  { id: "shell", label: "Shell" },
  { id: "plaintext", label: "Plain text" },
];

/** Look up a language's label, falling back to the raw id. */
export function languageLabel(id: string): string {
  return EDITOR_LANGUAGES.find((l) => l.id === id)?.label ?? id;
}
