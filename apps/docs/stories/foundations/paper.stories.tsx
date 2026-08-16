import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@elabs/components-ui";

/**
 * PAPER GROUNDS — an opt-in drafting sheet for a panel, card or section.
 *
 * Three ground utilities, each a different answer to "what is this surface made
 * of". All of them ink themselves from the active theme (`--paper-*` are
 * relative colours off `--foreground`), so they work on light, dark and on a
 * theme a consumer authors, with no per-theme classes:
 *
 * - **`bg-dot-grid`** — the dot field alone. The quietest, and the only one that
 *   survives under dense text: dots read as "measured surface" without ruling
 *   lines through the content.
 * - **`bg-paper`** — the full sheet: dot field + sparse construction rules +
 *   paper tooth. For a surface that should feel like a physical sheet — a hero,
 *   an empty state, a featured panel.
 * - **`bg-grid-paper`** — the engineering grid on the canvas colour. The existing
 *   utility, for a diagram/canvas field rather than a sheet.
 *
 * **These are NOT the decoration dial.** `--decoration` is the *ambient* texture:
 * it rides the dial, fades in across whole screens, and is inert at 0. A paper
 * ground is the opposite contract — you ask for it on one element and you get
 * it, at any decoration level. "The whole app reads as a blueprint" and "this
 * card is a sheet of paper" are different requests.
 *
 * **Budget: one focal ground per region.** A dotted card inside a dotted section
 * inside a gridded canvas is noise, not texture. Pick the outermost surface that
 * should read as paper and leave its children plain.
 *
 * Retune per surface with the tokens rather than new classes:
 * `--paper-dot-ink` / `--paper-dot-pitch` / `--paper-dot-size`,
 * `--paper-rule-ink` / `--paper-rule-pitch`, `--paper-grain-scale`.
 */
const meta = {
  title: "Foundations/Paper",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Opt-in drafting-paper grounds — `bg-dot-grid` (dot field), `bg-paper` " +
          "(dots + construction rules + tooth) and the existing `bg-grid-paper` " +
          "(engineering grid). Inks come from the `--paper-*` tokens, which are " +
          "relative colours off `--foreground`, so every theme re-tints them for " +
          "free. Independent of the `--decoration` dial.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const GROUNDS = [
  {
    utility: "bg-dot-grid",
    className: "bg-dot-grid",
    title: "Dot field",
    use: "Quietest. The one that survives under dense text.",
  },
  {
    utility: "bg-paper",
    className: "bg-paper",
    title: "Full sheet",
    use: "Dots + construction rules + tooth. Heroes, empty states, featured panels.",
  },
  {
    utility: "bg-grid-paper",
    className: "bg-grid-paper",
    title: "Engineering grid",
    use: "A canvas field rather than a sheet. Paints its own --canvas ground.",
  },
] as const;

/** The three grounds side by side, on the surface each is meant to sit on. */
export const Default: Story = {
  render: () => (
    <div className="grid gap-6 md:grid-cols-3">
      {GROUNDS.map((g) => (
        <Card key={g.utility} className={g.className}>
          <CardHeader>
            <CardTitle>{g.title}</CardTitle>
            <CardDescription>{g.use}</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="text-code font-mono text-muted-foreground">{g.utility}</code>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};

/**
 * The reason `bg-dot-grid` is the default choice for a working surface: a dot
 * field reads as measured paper without ruling a line through a single word.
 */
export const UnderContent: Story = {
  render: () => (
    <Card className="bg-dot-grid max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Survey sheet</CardTitle>
          <Badge variant="secondary">draft</Badge>
        </div>
        <CardDescription measure>
          The dot pitch is 12px by default, which is fine enough to read as a surface and coarse
          enough that it never fights a line of body text. If a surface needs it quieter still,
          raise <code>--paper-dot-pitch</code> or drop the alpha on <code>--paper-dot-ink</code> for
          that element alone — the utility reads the token, so a local override retunes it without a
          new class.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button size="sm">Continue</Button>
        <Button size="sm" variant="outline">
          Discard
        </Button>
      </CardContent>
    </Card>
  ),
};

/**
 * Retuning with the tokens instead of new utilities. Each panel carries the same
 * `bg-dot-grid` class and differs only in the `--paper-*` values it sets.
 */
export const Retuned: Story = {
  render: () => (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="bg-dot-grid [--paper-dot-pitch:8px]">
        <CardHeader>
          <CardTitle>Tight</CardTitle>
          <CardDescription>
            <code className="text-code font-mono">--paper-dot-pitch: 8px</code>
          </CardDescription>
        </CardHeader>
      </Card>
      <Card className="bg-dot-grid">
        <CardHeader>
          <CardTitle>Default</CardTitle>
          <CardDescription>
            <code className="text-code font-mono">12px / 1px</code>
          </CardDescription>
        </CardHeader>
      </Card>
      <Card className="bg-dot-grid [--paper-dot-pitch:24px] [--paper-dot-size:1.5px]">
        <CardHeader>
          <CardTitle>Open</CardTitle>
          <CardDescription>
            <code className="text-code font-mono">24px / 1.5px</code>
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  ),
};

/**
 * A full sheet as a section ground, with plain cards on top — the budget rule in
 * practice. The section is the paper; its children are objects placed on it, so
 * they keep their own flat `bg-card`.
 */
export const SheetWithContent: Story = {
  render: () => (
    <section className="bg-paper rounded-lg border p-8">
      <div className="mb-6 max-w-prose">
        <h2 className="text-title">Plate 04 — Assembly</h2>
        <p className="text-body text-muted-foreground text-pretty">
          One focal ground per region: the sheet is the section, not each card. Nesting a second
          paper ground inside this one reads as noise rather than texture.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {["Hull", "Drive", "Rig"].map((part, i) => (
          <Card key={part}>
            <CardHeader>
              <CardTitle>{part}</CardTitle>
              <CardDescription>Item {String(i + 1).padStart(2, "0")}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  ),
};
