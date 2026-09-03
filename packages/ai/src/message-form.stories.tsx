/**
 * MessageForm — **not a chat input.** A model-emitted form rendered INSIDE a
 * message.
 *
 * It sits next to `Composer` in the sidebar and reads like a sibling of it; it
 * is not one. The composer is the field a person types their turn into
 * ([AI/Composer](?path=/docs/ai-composer--docs)); this is a form the MODEL
 * authored — it emits a serializable `FormSpec` (`message-form-spec.ts`), the
 * user fills it in place in the transcript, and the app receives structured
 * `{ formName, values }` on submit.
 *
 * Spec-driven and zod-validated: the model is the author, it never chooses the
 * look. A malformed spec degrades to `MessageFormFallback` rather than
 * throwing, half-arrived fields are dropped while streaming, and a submitted
 * form renders inert with its values still visible — a chat message is a
 * historical record.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { MessageForm } from "./message-form";
import type { FormSpec, FormValues } from "./message-form-spec";

const meta = {
  title: "AI/MessageForm",
  component: MessageForm,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Not a chat input. A model-emitted form rendered inside a message. " +
          "The composer is the field a person types their turn into ([AI/Composer](?path=/docs/ai-composer--docs)); this is a form the MODEL authored — it emits a serializable FormSpec, the user fills it in place in the transcript, and the app receives structured `{ formName, values }` on submit. " +
          "Spec-driven and zod-validated (the model is the author, it never chooses the look): a malformed spec degrades to MessageFormFallback rather than throwing, half-arrived fields are dropped while streaming, and a submitted form renders inert with its values still visible, because a chat message is a historical record. " +
          "Composes @elabs-ai/components-ui inputs; semantic tokens only; reads in all themes.",
      },
    },
  },
} satisfies Meta<typeof MessageForm>;
export default meta;
type Story = StoryObj<typeof meta>;

// A representative spec an LLM tool-call might emit inside a chat message.
const contactSpec: FormSpec = {
  formName: "book_demo",
  title: "Book a demo",
  description: "Tell us a little about your team and we'll set up a tailored walkthrough.",
  submitLabel: "Request demo",
  fields: [
    { type: "string", name: "fullName", label: "Full name", required: true, minLength: 2 },
    { type: "string", name: "email", label: "Work email", format: "email", required: true },
    { type: "string", name: "company", label: "Company" },
    {
      type: "enum",
      name: "teamSize",
      label: "Team size",
      required: true,
      options: [
        { const: "1-10", title: "1–10" },
        { const: "11-50", title: "11–50" },
        { const: "51-200", title: "51–200" },
        { const: "200+", title: "200+" },
      ],
    },
    {
      type: "multi-enum",
      name: "interests",
      label: "What are you interested in?",
      options: ["Dashboards", "Data tables", "AI assistant", "Maps"],
    },
    { type: "integer", name: "seats", label: "Seats needed", min: 1, max: 500, default: 10 },
    {
      type: "string",
      name: "notes",
      label: "Anything else?",
      multiline: true,
      description: "Optional — share any specifics about your use case.",
      maxLength: 500,
    },
    { type: "boolean", name: "newsletter", label: "Send me product updates", default: false },
  ],
};

/** The default: an uncontrolled form. Submitting logs `{ formName, values }`. */
export const Default: Story = {
  args: {
    spec: contactSpec,
    onSubmit: (state) => console.info("submit", state),
  },
};

/**
 * Streaming / partial — the spec is still arriving. Only the fields that have
 * fully parsed render; the rest is a skeleton. Never a crash, never null holes.
 */
export const StreamingPartial: Story = {
  args: {
    streaming: true,
    spec: {
      formName: "book_demo",
      title: "Book a demo",
      fields: [
        { type: "string", name: "fullName", label: "Full name", required: true },
        // A half-arrived field (no `type` yet) is dropped, not fatal:
        { name: "email" } as never,
      ],
    },
  },
};

/** Streaming with nothing parsed yet → a layout-shaped skeleton. */
export const StreamingSkeleton: Story = {
  args: {
    streaming: true,
    spec: { formName: "book_demo", title: "Book a demo", fields: [] },
  },
};

/** Empty (not streaming) → a calm fallback, never broken UI. */
export const Empty: Story = {
  args: {
    spec: { formName: "empty", title: "Nothing to fill in", fields: [] },
  },
};

/** Fallback — a malformed / non-object spec renders a typed fallback (no throw). */
export const Fallback: Story = {
  args: {
    spec: "not a form spec" as unknown,
  },
};

/** Validation — submit with an invalid email + missing required fields. */
export const Validation: Story = {
  args: {
    spec: {
      formName: "signup",
      title: "Create your account",
      fields: [
        { type: "string", name: "email", label: "Email", format: "email", required: true },
        {
          type: "string",
          name: "handle",
          label: "Handle",
          required: true,
          minLength: 3,
          pattern: "^[a-z0-9_]+$",
        },
        { type: "string", name: "site", label: "Website", format: "uri" },
        { type: "integer", name: "age", label: "Age", min: 13, max: 120 },
      ],
    },
  },
};

/** Controlled — the parent owns `values`; here a live JSON preview reflects them. */
export const Controlled: Story = {
  render: function Controlled() {
    const [values, setValues] = useState<FormValues>({ fullName: "", teamSize: "11-50" });
    return (
      <div className="flex flex-col gap-4">
        <MessageForm
          spec={contactSpec}
          values={values}
          onChange={setValues}
          onSubmit={(state) => console.info("submit", state)}
        />
        <pre className="overflow-x-auto rounded-md border border-border bg-surface-muted p-3 text-caption text-muted-foreground">
          {JSON.stringify(values, null, 2)}
        </pre>
      </div>
    );
  },
};

/** Submitting — the request is in flight (controls disabled, spinner on submit). */
export const Submitting: Story = {
  args: { spec: contactSpec, submitting: true },
};

/** Submitted — a terminal, inert historical record with values visible. */
export const Submitted: Story = {
  args: {
    spec: contactSpec,
    submitted: true,
    values: {
      fullName: "Dana Lee",
      email: "dana@acme.com",
      company: "Acme",
      teamSize: "51-200",
      interests: ["Dashboards", "AI assistant"],
      seats: 25,
      newsletter: true,
    },
  },
};

/** Dark theme — verifies token-driven surfaces + focus rings in dark. The
 *  theme is scoped to this story via a `data-theme` decorator (NOT a `globals`
 *  override, which would stick and re-theme the whole Docs page). */
export const DarkTheme: Story = {
  args: { spec: contactSpec },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="rounded-lg bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
};
