import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  SchemaForm,
  SchemaFormFields,
  SchemaFormProvider,
  SchemaFormRoot,
  SchemaFormSubmit,
  SchemaFormTestAction,
  SchemaFormTitle,
} from "./schema-form";
import type { FormSpec, FormValues } from "./schema-form-spec";
import { fromJsonSchema } from "./from-json-schema";

const meta = {
  title: "Forms/SchemaForm",
  component: SchemaForm,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof SchemaForm>;
export default meta;
type Story = StoryObj<typeof meta>;

// A representative "connector settings" spec — the Onyx-style shape issue #22
// asks for: scalars, a repeating list, a repeating key/value list, a file
// upload, and two flavors of grouped alternative fields (mutually-exclusive
// tabs vs. always-visible advanced disclosures).
const connectorSpec: FormSpec = {
  formName: "connector_settings",
  title: "Connector settings",
  description: "Configure how this connector syncs data into your workspace.",
  submitLabel: "Save connector",
  fields: [
    { type: "string", name: "name", label: "Connector name", required: true, minLength: 2 },
    {
      type: "string",
      name: "baseUrl",
      label: "Base URL",
      format: "uri",
      required: true,
      description: "The root endpoint this connector reads from.",
    },
    {
      type: "integer",
      name: "pollIntervalMinutes",
      label: "Poll interval (minutes)",
      min: 1,
      max: 1440,
      default: 15,
    },
    { type: "boolean", name: "enabled", label: "Enabled", default: true },
    {
      type: "enum",
      name: "environment",
      label: "Environment",
      required: true,
      options: [
        { const: "dev", title: "Development" },
        { const: "staging", title: "Staging" },
        { const: "prod", title: "Production" },
      ],
    },
    {
      type: "multi-enum",
      name: "tags",
      label: "Tags",
      options: ["Docs", "Code", "Tickets", "Chat"],
    },
    {
      type: "list",
      name: "allowedDomains",
      label: "Allowed domains",
      itemPlaceholder: "example.com",
      maxItems: 10,
    },
    {
      type: "key-value",
      name: "headers",
      label: "Request headers",
      keyPlaceholder: "Header",
      valuePlaceholder: "Value",
      description: "Sent with every outbound request.",
    },
    {
      type: "file",
      name: "credentialsFile",
      label: "Service-account credentials",
      accept: ".json",
      maxSize: 1024 * 1024,
      description: "A JSON key file, up to 1 MB.",
    },
    {
      type: "group",
      name: "auth",
      label: "Authentication",
      variant: "tabs",
      groups: [
        {
          key: "apiKey",
          label: "API key",
          fields: [{ type: "string", name: "apiKey", label: "API key", required: true }],
        },
        {
          key: "oauth",
          label: "OAuth",
          fields: [
            { type: "string", name: "clientId", label: "Client ID", required: true },
            { type: "string", name: "clientSecret", label: "Client secret", required: true },
          ],
        },
      ],
    },
    {
      type: "group",
      name: "advanced",
      label: "Advanced",
      variant: "advanced",
      groups: [
        {
          key: "rateLimiting",
          label: "Rate limiting",
          fields: [
            {
              type: "integer",
              name: "requestsPerMinute",
              label: "Requests per minute",
              min: 1,
              default: 60,
            },
          ],
        },
        {
          key: "retry",
          label: "Retry policy",
          fields: [
            { type: "integer", name: "maxRetries", label: "Max retries", min: 0, default: 3 },
            { type: "number", name: "backoffSeconds", label: "Backoff (seconds)", min: 0 },
          ],
        },
      ],
    },
  ],
};

/** First run: an uncontrolled form, nothing submitted yet. Every field type + both group variants render. */
export const Default: Story = {
  args: {
    spec: connectorSpec,
    onSubmit: (state) => console.info("submit", state),
  },
};

/** Controlled — the parent owns `values`; a live JSON preview reflects them as you type. */
export const Controlled: Story = {
  render: function Controlled() {
    const [values, setValues] = useState<FormValues>({ environment: "staging", enabled: true });
    return (
      <div className="flex flex-col gap-4">
        <SchemaForm
          spec={connectorSpec}
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

/**
 * Conditional visibility (`visibleWhen: { field, equals }`, issue #22) — the
 * "client secret" field only renders (and only participates in validation)
 * once "Auth method" is switched to OAuth; while hidden it can never block
 * submit, even though it's `required`.
 */
export const ConditionalField: Story = {
  args: {
    spec: {
      formName: "connector_auth",
      title: "Authentication",
      fields: [
        {
          type: "enum",
          name: "authMethod",
          label: "Auth method",
          default: "apikey",
          options: [
            { const: "apikey", title: "API key" },
            { const: "oauth", title: "OAuth" },
          ],
        },
        {
          type: "string",
          name: "clientSecret",
          label: "Client secret",
          required: true,
          visibleWhen: { field: "authMethod", equals: "oauth" },
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    // Hidden while the default "API key" method is active.
    expect(canvas.queryByLabelText(/Client secret/)).not.toBeInTheDocument();

    // Switch to OAuth through the real Select control.
    await userEvent.click(canvas.getByRole("combobox", { name: /Auth method/ }));
    await userEvent.click(await body.findByRole("option", { name: "OAuth" }));

    // Now it renders...
    await waitFor(() => {
      expect(canvas.getByLabelText(/Client secret/)).toBeInTheDocument();
    });

    // ...and, being required, blocks submit while empty.
    await userEvent.click(canvas.getByRole("button", { name: "Submit" }));
    await waitFor(() => {
      expect(canvas.getByLabelText(/Client secret/)).toHaveFocus();
    });
  },
};

/**
 * Validation — submitting with missing required fields and a bad email-shaped
 * URL surfaces inline errors and moves focus to the first invalid control.
 */
export const Validation: Story = {
  args: {
    spec: {
      formName: "signup",
      title: "Create your workspace",
      fields: [
        { type: "string", name: "orgName", label: "Organization name", required: true },
        {
          type: "string",
          name: "adminEmail",
          label: "Admin email",
          format: "email",
          required: true,
        },
        { type: "integer", name: "seats", label: "Seats", min: 1, max: 500 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Submit" }));
    await waitFor(() => {
      expect(canvas.getAllByText("This field is required.").length).toBeGreaterThan(0);
    });
    // Focus moved to the first invalid field (the a11y "don't leave the user hunting" contract).
    await waitFor(() => {
      expect(canvas.getByLabelText(/Organization name/)).toHaveFocus();
    });
  },
};

/** Submitting — the request is in flight: controls are blocked, the submit button shows a spinner and stays focusable (`aria-disabled`, never native `disabled`). */
export const Submitting: Story = {
  args: { spec: connectorSpec, submitting: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Submitting…" });
    // Never natively disabled while transiently blocked — see interaction-guidelines.md.
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
  },
};

/** Submitted — a terminal, inert record: controls are read-only, values stay visible, the submit button is replaced by a status badge. */
export const Submitted: Story = {
  args: {
    spec: connectorSpec,
    submitted: true,
    values: {
      name: "Zendesk sync",
      baseUrl: "https://api.zendesk.com",
      pollIntervalMinutes: 30,
      enabled: true,
      environment: "prod",
      tags: ["Tickets", "Chat"],
      allowedDomains: ["zendesk.com"],
      headers: [{ key: "Authorization", value: "Bearer •••", secret: true }],
      auth: "apiKey",
      apiKey: "sk_live_•••",
    },
  },
};

/** A terminal, form-level submission error (e.g. the save request failed) rendered above the submit control. */
export const SubmissionError: Story = {
  args: {
    spec: connectorSpec,
    error: "Couldn't save this connector. Check your network connection and try again.",
  },
};

/**
 * No fields yet (spec still loading) → a layout-shaped, announced skeleton —
 * never a blank panel. Composed directly from the compound parts
 * (`SchemaFormProvider` → `SchemaFormRoot` → `SchemaFormFields`) rather than
 * the `SchemaForm` convenience wrapper, to also document that lower-level API.
 */
export const Loading: Story = {
  render: () => (
    <SchemaFormProvider
      spec={{ formName: "connector_settings", title: "Connector settings", fields: [] }}
      loading={true}
    >
      <SchemaFormRoot>
        <SchemaFormTitle />
        <SchemaFormFields />
      </SchemaFormRoot>
    </SchemaFormProvider>
  ),
};

/** Empty (not loading) — a spec with zero fields renders a calm fallback, never a broken empty form. */
export const Empty: Story = {
  args: {
    spec: { formName: "empty", fields: [] },
  },
};

/** Fallback — a malformed / non-object spec renders a typed fallback, never a throw. */
export const Fallback: Story = {
  args: {
    spec: "not a form spec",
  },
};

/**
 * Overflowing content — long labels, a long description, and many enum
 * options still wrap/scroll gracefully instead of breaking the layout.
 */
export const OverflowingContent: Story = {
  args: {
    spec: {
      formName: "overflow",
      title: "Migrate historical tickets from the legacy on-premises support desk",
      description:
        "This one-time migration copies every ticket, attachment, and internal note from the legacy system into the new workspace. Depending on volume this can take several hours; you can safely close this dialog once it starts.",
      fields: [
        {
          type: "string",
          name: "notes",
          label: "Additional context for the migration team handling this request",
          multiline: true,
          description:
            "Include any known data-quality issues, custom fields that must be mapped manually, or dates the migration must avoid.",
        },
        {
          type: "enum",
          name: "region",
          label: "Data residency region for the migrated archive",
          options: [
            { const: "us-east-1", title: "US East (N. Virginia) — primary production region" },
            { const: "us-west-2", title: "US West (Oregon) — disaster-recovery region" },
            { const: "eu-central-1", title: "EU Central (Frankfurt) — GDPR data-residency region" },
          ],
        },
      ],
    },
  },
};

/** A file field's designed states: a valid file, a rejected wrong-type file, and a rejected too-large file all render distinctly (never a silent drop). */
export const FileFieldStates: Story = {
  args: {
    spec: {
      formName: "upload",
      title: "Upload credentials",
      fields: [
        {
          type: "file",
          name: "credentialsFile",
          label: "Service-account credentials",
          accept: ".json",
          multiple: true,
          maxSize: 1024,
          description:
            "A JSON key file, up to 1 KB (kept small so this demo can show the too-large state).",
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvasElement.querySelector('input[type="file"]') as HTMLInputElement;

    const goodFile = new File(['{"type":"service_account"}'], "creds.json", {
      type: "application/json",
    });
    const wrongTypeFile = new File(["binary"], "creds.exe", { type: "application/x-msdownload" });
    const tooLargeFile = new File([new Uint8Array(2048)], "big.json", {
      type: "application/json",
    });

    // The good file and the too-large file both go through the real picker —
    // `checkFileIssue` (not the native input) is what flags the too-large one,
    // so it still renders with visible feedback instead of vanishing.
    await userEvent.upload(input, [goodFile, tooLargeFile]);
    await waitFor(() => {
      expect(canvas.getByText("creds.json")).toBeInTheDocument();
      expect(canvas.getByText("big.json")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(canvas.getByText(/larger than the 1\.0 KB limit/)).toBeInTheDocument();
    });

    // The wrong-type file goes through a drag-and-drop instead of the native
    // picker: real browsers can filter a programmatic `input.files` set
    // against the field's `accept` hint (the same silent-drop failure mode
    // `maxSize` had), but a drop's `DataTransfer` is never filtered that way —
    // exactly like a real user dragging in a mismatched file — so it reaches
    // `checkFileIssue` and renders with its own visible error.
    const dropzone = canvasElement.querySelector(
      '[data-slot="file-upload-dropzone"]',
    ) as HTMLElement;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(wrongTypeFile);
    dropzone.dispatchEvent(
      new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }),
    );
    await waitFor(() => {
      expect(canvas.getByText("creds.exe")).toBeInTheDocument();
      expect(canvas.getByText("This file type isn't accepted.")).toBeInTheDocument();
    });
  },
};

/** Disabled — the whole form is a deliberate, durable read-only surface (every control natively disabled, not just visually dimmed). */
export const Disabled: Story = {
  args: { spec: connectorSpec, disabled: true },
};

/** Dark theme — verifies token-driven surfaces + focus rings in dark. Scoped via a `data-theme` decorator, not a `globals` override, so it doesn't re-theme the whole Docs page. */
export const DarkTheme: Story = {
  args: { spec: connectorSpec },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="rounded-lg bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
};

const testActionSpec: FormSpec = {
  formName: "connector_test",
  title: "Connect a data source",
  fields: [
    { type: "string", name: "host", label: "Host", required: true, default: "api.example.com" },
    { type: "string", name: "apiKey", label: "API key", required: true },
  ],
};

/**
 * `SchemaFormTestAction` (issue #22 maintainer ruling, 2026-09-01) — a
 * form-level "Test connection" affordance, composed alongside
 * `SchemaFormSubmit` but entirely independent of it: it never reads or
 * blocks field validity, and its own pending/success/failure state never
 * gates `submit()`. Placed directly under `SchemaFormRoot`, not inside the
 * default `SchemaForm` composition — it's an opt-in part a consumer places.
 */
export const TestConnectionAction: Story = {
  render: function TestConnectionAction() {
    return (
      <SchemaFormProvider spec={testActionSpec} onSubmit={(state) => console.info("submit", state)}>
        <SchemaFormRoot className="flex flex-col gap-6">
          <SchemaFormTitle />
          <SchemaFormFields />
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <SchemaFormTestAction
              onTest={async (values) => {
                await new Promise((resolve) => setTimeout(resolve, 600));
                if (!values.apiKey) throw new Error("API key is required to test the connection");
              }}
            />
            <SchemaFormSubmit />
          </div>
        </SchemaFormRoot>
      </SchemaFormProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Fill only the field the test action itself checks — the OTHER
    // required field ("Host") is left with its default and never
    // validated by this click, proving the test action doesn't run
    // (or depend on) SchemaForm's own validation.
    await userEvent.type(canvas.getByLabelText(/API key/), "sk-live-demo");
    await userEvent.click(canvas.getByRole("button", { name: "Test connection" }));

    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Testing…" })).toBeInTheDocument();
    });
    await waitFor(
      () => {
        expect(canvas.getByText("Connected")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  },
};

// A connector manifest expressed as JSON Schema — the shape `fromJsonSchema()`
// (issue #22 maintainer ruling, 2026-09-01) targets: an OpenAPI-style request
// body using only the documented subset (string/enum/number/integer/boolean/
// array-of-string/object).
const connectorJsonSchema = {
  type: "object",
  title: "Connector settings",
  description: "Configure how this connector syncs data into your workspace.",
  properties: {
    name: { type: "string", title: "Connector name", minLength: 1 },
    environment: {
      type: "string",
      title: "Environment",
      enum: ["production", "staging", "development"],
      default: "staging",
    },
    syncIntervalMinutes: {
      type: "integer",
      title: "Sync interval (minutes)",
      minimum: 5,
      maximum: 1440,
      default: 60,
    },
    enabled: { type: "boolean", title: "Enabled", default: true },
    tags: { type: "array", title: "Tags", items: { type: "string" } },
    advanced: {
      type: "object",
      title: "Advanced",
      properties: {
        timeoutSeconds: { type: "number", title: "Timeout (seconds)", minimum: 1, default: 30 },
        retries: { type: "integer", title: "Retries", minimum: 0, maximum: 10, default: 3 },
      },
    },
  },
  required: ["name"],
} as const;

/**
 * `fromJsonSchema()` (issue #22 maintainer ruling, 2026-09-01) — maps a
 * documented JSON Schema subset (an OpenAPI request body or connector
 * manifest already described that way) onto `FormSpec`, so `SchemaForm`
 * renders it without hand-authoring the field list.
 */
export const FromJsonSchema: Story = {
  render: function FromJsonSchema() {
    const spec = fromJsonSchema(connectorJsonSchema, {
      formName: "connector_from_json_schema",
      submitLabel: "Save connector",
    });
    return <SchemaForm spec={spec} onSubmit={(state) => console.info("submit", state)} />;
  },
};
