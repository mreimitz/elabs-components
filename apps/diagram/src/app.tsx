import { useTheme } from "@elabs-ai/components-tokens";
import { Button, Heading, Text } from "@elabs-ai/components-ui";

/**
 * P0 smoke screen (DG-01) — proves the Vite skeleton, token wiring and brand
 * theme families render. DG-02 replaces this with the dashboard app shell.
 */
export function App() {
  const { theme, themes, setTheme } = useTheme();

  return (
    <main className="min-h-dvh bg-background p-8 text-foreground">
      <Heading level={1}>Diagram</Heading>
      <Text className="mt-2">
        Architecture diagrams from YAML on the flow canvas — app skeleton (DG-01).
      </Text>
      <div className="mt-6 flex items-center gap-4">
        <Button>Get started</Button>
        {/* Plain <select> for this smoke screen only, as the item specifies;
            DG-02 replaces it with the dashboard shell's theme switcher. */}
        <select
          aria-label="Theme"
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-body focus-ring"
        >
          {themes.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </main>
  );
}
