import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaForm } from "./schema-form";
import {
  fieldSpecSchema,
  fileMatchesAccept,
  findFieldByName,
  formSpecSchema,
  normalizeFormSpec,
  validateField,
  type FormSpec,
} from "./schema-form-spec";

const simpleSpec: FormSpec = {
  formName: "signup",
  title: "Sign up",
  fields: [
    { type: "string", name: "name", label: "Name", required: true },
    { type: "string", name: "email", label: "Email", format: "email", required: true },
  ],
};

const groupSpec: FormSpec = {
  formName: "connector",
  title: "Connector",
  fields: [
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
          fields: [{ type: "string", name: "clientId", label: "Client ID", required: true }],
        },
      ],
    },
  ],
};

// A controlling enum field plus a target field that's only visible (and only
// validated) once the controlling field equals "oauth" — issue #22's
// `visibleWhen: { field, equals }` conditional-visibility ask.
const conditionalSpec: FormSpec = {
  formName: "connector_auth",
  fields: [
    {
      type: "enum",
      name: "authMethod",
      label: "Auth method",
      options: ["oauth", "apikey"],
    },
    {
      type: "string",
      name: "clientSecret",
      label: "Client secret",
      required: true,
      visibleWhen: { field: "authMethod", equals: "oauth" },
    },
  ],
};

describe("SchemaForm — rendering", () => {
  it("renders the title, fields, and a submit button", () => {
    render(<SchemaForm spec={simpleSpec} />);
    expect(screen.getByText("Sign up")).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("labels the form via aria-labelledby pointing at the title", () => {
    render(<SchemaForm spec={simpleSpec} />);
    expect(screen.getByRole("form", { name: "Sign up" })).toBeInTheDocument();
  });

  it("uses the humanized name when no label is given", () => {
    render(
      <SchemaForm spec={{ formName: "f", fields: [{ type: "string", name: "first_name" }] }} />,
    );
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
  });

  it("renders a list field's label without a native htmlFor association (it's a multi-row region)", () => {
    render(
      <SchemaForm
        spec={{
          formName: "f",
          fields: [{ type: "list", name: "domains", label: "Allowed domains" }],
        }}
      />,
    );
    const label = screen.getByText("Allowed domains");
    expect(label).toBeInTheDocument();
    expect(label).not.toHaveAttribute("for");
    expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument();
  });

  it("renders a key-value field", () => {
    render(
      <SchemaForm
        spec={{ formName: "f", fields: [{ type: "key-value", name: "headers", label: "Headers" }] }}
      />,
    );
    expect(screen.getByText("Headers")).toBeInTheDocument();
  });

  it("renders a file field", () => {
    render(
      <SchemaForm
        spec={{ formName: "f", fields: [{ type: "file", name: "creds", label: "Credentials" }] }}
      />,
    );
    expect(screen.getByText("Credentials")).toBeInTheDocument();
  });

  it("renders a group field's tabs and only the active branch's fields", () => {
    render(<SchemaForm spec={groupSpec} />);
    expect(screen.getByRole("tab", { name: "API key" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "OAuth" })).toBeInTheDocument();
    // The active branch's own field ("API key") is present; the role narrows
    // past the tab trigger, which shares the same visible text.
    expect(screen.getByRole("textbox", { name: /API key/ })).toBeInTheDocument();
  });

  it("renders a group field's advanced branches as disclosures", () => {
    render(
      <SchemaForm
        spec={{
          formName: "f",
          fields: [
            {
              type: "group",
              name: "advanced",
              label: "Advanced",
              variant: "advanced",
              groups: [
                {
                  key: "retry",
                  label: "Retry policy",
                  fields: [{ type: "integer", name: "maxRetries", label: "Max retries" }],
                },
              ],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Retry policy")).toBeInTheDocument();
  });
});

describe("SchemaForm — never throws / fallback", () => {
  it("renders a fallback for a non-object spec (does not throw)", () => {
    render(<SchemaForm spec={"nope" as unknown} />);
    expect(screen.getByText(/could not|missing or malformed/i)).toBeInTheDocument();
  });

  it("renders a fallback for a valid-but-empty spec when not loading", () => {
    render(<SchemaForm spec={{ formName: "x", fields: [] }} />);
    expect(screen.getByText(/no fields/i)).toBeInTheDocument();
  });

  it("renders a skeleton (not a fallback) for an empty spec while loading", () => {
    const { container } = render(<SchemaForm spec={{ formName: "x", fields: [] }} loading />);
    expect(screen.queryByText(/no fields/i)).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"] .animate-pulse')).not.toBeNull();
  });
});

describe("SchemaForm — validation (submit) + focus-first-invalid", () => {
  it("blocks submit, shows inline errors, and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SchemaForm spec={simpleSpec} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText("This field is required.").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Name/)).toHaveFocus();
  });

  it("submits { formName, values } when valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SchemaForm spec={simpleSpec} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Name/), "Dana");
    await user.type(screen.getByLabelText(/Email/), "dana@acme.com");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({
      formName: "signup",
      values: expect.objectContaining({ name: "Dana", email: "dana@acme.com" }),
    });
  });

  it("only validates the ACTIVE tab branch for a `variant: tabs` group", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SchemaForm spec={groupSpec} onSubmit={onSubmit} />);
    // The "apiKey" branch is active by default; its field is required and empty.
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
    // Switching to OAuth and filling ITS field should let submit succeed —
    // the API-key branch's now-inactive required field must not block it.
    await user.click(screen.getByRole("tab", { name: "OAuth" }));
    await user.type(screen.getByLabelText(/Client ID/), "abc123");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({
      formName: "connector",
      values: expect.objectContaining({ auth: "oauth", clientId: "abc123" }),
    });
  });

  it("strips the INACTIVE tab branch's fields from the submitted values, not just its validation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SchemaForm spec={groupSpec} onSubmit={onSubmit} />);
    // Type into the API-key branch first, then switch away from it. The role
    // narrows past the "API key" tab trigger, which shares the visible text.
    await user.type(screen.getByRole("textbox", { name: /API key/ }), "secret-key");
    await user.click(screen.getByRole("tab", { name: "OAuth" }));
    await user.type(screen.getByLabelText(/Client ID/), "abc123");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    // Exact match (not objectContaining): a stray "apiKey" key left over from
    // the now-inactive branch would fail this.
    expect(onSubmit).toHaveBeenCalledWith({
      formName: "connector",
      values: { auth: "oauth", clientId: "abc123" },
    });
  });

  it("hides a `visibleWhen` field while its controlling value is unset, and never blocks submit on it while hidden", async () => {
    const onSubmit = vi.fn();
    render(<SchemaForm spec={conditionalSpec} values={{}} onSubmit={onSubmit} />);
    // Unset controlling value → the target field isn't rendered at all.
    expect(screen.queryByLabelText(/Client secret/)).not.toBeInTheDocument();

    // Submitting must not report a validation error for the hidden required
    // field — it must not even reach `validateForm`/the focus walk.
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({
      formName: "connector_auth",
      values: expect.objectContaining({ authMethod: undefined }),
    });
  });

  it("reveals a `visibleWhen` field once its controlling field matches, and blocks submit on it once visible+required", async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <SchemaForm spec={conditionalSpec} values={{ authMethod: "apikey" }} onSubmit={onSubmit} />,
    );
    // Still hidden for the OTHER enum option ("apikey" ≠ "oauth").
    expect(screen.queryByLabelText(/Client secret/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({
      formName: "connector_auth",
      values: expect.objectContaining({ authMethod: "apikey" }),
    });

    // Switching the controlling field to "oauth" reveals it — and now it DOES
    // block submit while empty (it's `required`).
    onSubmit.mockClear();
    rerender(
      <SchemaForm spec={conditionalSpec} values={{ authMethod: "oauth" }} onSubmit={onSubmit} />,
    );
    expect(screen.getByLabelText(/Client secret/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByLabelText(/Client secret/)).toHaveFocus();
    });
  });

  it("blocks submit and shows an inline error for a file that fails validation (wrong type)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const badFile = new File(["x"], "creds.exe", { type: "application/x-msdownload" });
    render(
      <SchemaForm
        spec={{
          formName: "f",
          fields: [{ type: "file", name: "creds", label: "Credentials", accept: ".json" }],
        }}
        values={{ creds: [badFile] }}
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText("This file type isn't accepted.").length).toBeGreaterThan(0);
  });

  it("auto-reveals a collapsed advanced-group branch that holds the first invalid field, and focuses it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <SchemaForm
        spec={{
          formName: "f",
          fields: [
            {
              type: "group",
              name: "advanced",
              label: "Advanced",
              variant: "advanced",
              groups: [
                {
                  key: "retry",
                  label: "Retry policy",
                  fields: [{ type: "string", name: "apiKey", label: "API key", required: true }],
                },
              ],
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );
    // Collapsed by default — the field isn't reachable yet.
    expect(screen.queryByLabelText(/API key/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByLabelText(/API key/)).toHaveFocus();
    });
  });
});

describe("SchemaForm — submit control a11y (never natively disabled while submitting)", () => {
  it("keeps the submit button focusable and in the tab order while submitting", () => {
    render(<SchemaForm spec={simpleSpec} submitting />);
    const button = screen.getByRole("button", { name: "Submitting…" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("ignores a click while submitting (handler guard backs the aria-disabled affordance)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SchemaForm spec={simpleSpec} submitting onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Submitting…" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("natively disables every control for an explicit, durable disabled form", () => {
    render(<SchemaForm spec={simpleSpec} disabled />);
    expect(screen.getByLabelText(/Name/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });
});

describe("SchemaForm — spec swap (uncontrolled values)", () => {
  it("resets uncontrolled internal values when the spec's formName changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SchemaForm spec={{ formName: "a", fields: [{ type: "string", name: "x", label: "X" }] }} />,
    );
    await user.type(screen.getByLabelText("X"), "hello");
    expect(screen.getByLabelText("X")).toHaveValue("hello");

    // A different spec (new formName) that happens to reuse the field name
    // "x" — without a reset, the stale "hello" would leak into the new spec.
    rerender(
      <SchemaForm
        spec={{ formName: "b", fields: [{ type: "string", name: "x", label: "X (form b)" }] }}
      />,
    );
    expect(screen.getByLabelText("X (form b)")).toHaveValue("");
  });

  it("does NOT reset values on an ordinary re-render with the SAME formName", async () => {
    const user = userEvent.setup();
    const spec = { formName: "a", fields: [{ type: "string" as const, name: "x", label: "X" }] };
    const { rerender } = render(<SchemaForm spec={spec} />);
    await user.type(screen.getByLabelText("X"), "hello");
    // A fresh object with the SAME formName/content (SchemaForm normalizes it
    // fresh every render) must not be mistaken for a spec swap.
    rerender(<SchemaForm spec={{ ...spec }} />);
    expect(screen.getByLabelText("X")).toHaveValue("hello");
  });
});

describe("SchemaForm — file field is controlled", () => {
  it("renders a file seeded via `values` in the picker (not just its own internal state)", () => {
    const file = new File(["{}"], "creds.json", { type: "application/json" });
    render(
      <SchemaForm
        spec={{ formName: "f", fields: [{ type: "file", name: "creds", label: "Credentials" }] }}
        values={{ creds: [file] }}
      />,
    );
    expect(screen.getByText("creds.json")).toBeInTheDocument();
  });
});

describe("SchemaForm — controlled + submitted", () => {
  it("reflects controlled values and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SchemaForm spec={simpleSpec} values={{ name: "Seed" }} onChange={onChange} />);
    expect(screen.getByLabelText(/Name/)).toHaveValue("Seed");
    await user.type(screen.getByLabelText(/Email/), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("renders an inert submitted state with values visible and no submit button", () => {
    render(<SchemaForm spec={simpleSpec} submitted values={{ name: "Dana", email: "d@a.co" }} />);
    expect(screen.getByLabelText(/Name/)).toHaveValue("Dana");
    expect(screen.getByLabelText(/Name/)).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("renders a terminal, form-level submission error", () => {
    render(<SchemaForm spec={simpleSpec} error="Couldn't save." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save.");
  });
});

describe("schema-form-spec", () => {
  it("formSpecSchema accepts a well-formed spec, including group/list/key-value/file fields", () => {
    expect(
      formSpecSchema.safeParse({
        formName: "f",
        fields: [
          { type: "list", name: "l" },
          { type: "key-value", name: "kv" },
          { type: "file", name: "file" },
          {
            type: "group",
            name: "g",
            variant: "advanced",
            groups: [{ key: "a", label: "A", fields: [{ type: "string", name: "x" }] }],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects a password/credential field (no such format)", () => {
    expect(
      fieldSpecSchema.safeParse({ type: "string", name: "pw", format: "password" }).success,
    ).toBe(false);
  });

  it("normalizeFormSpec drops invalid top-level fields but keeps valid ones", () => {
    const result = normalizeFormSpec({
      formName: "f",
      fields: [{ type: "string", name: "ok" }, { nope: true }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.fields).toHaveLength(1);
      expect(result.spec.fields[0]?.name).toBe("ok");
    }
  });

  it("findFieldByName resolves a field nested inside a group branch", () => {
    const found = findFieldByName(groupSpec.fields, "clientId");
    expect(found?.name).toBe("clientId");
  });

  it("normalizeFormSpec drops a nested field whose name collides with an already-accepted one", () => {
    const result = normalizeFormSpec({
      formName: "f",
      fields: [
        { type: "string", name: "shared" },
        {
          type: "group",
          name: "g",
          variant: "advanced",
          groups: [{ key: "a", label: "A", fields: [{ type: "string", name: "shared" }] }],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.fields).toHaveLength(1);
      expect(result.spec.fields[0]?.name).toBe("shared");
    }
  });

  it("normalizeFormSpec drops a group whose OWN two branches collide with each other", () => {
    const result = normalizeFormSpec({
      formName: "f",
      fields: [
        {
          type: "group",
          name: "g",
          variant: "advanced",
          groups: [
            { key: "a", label: "A", fields: [{ type: "string", name: "dup" }] },
            { key: "b", label: "B", fields: [{ type: "string", name: "dup" }] },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.fields).toHaveLength(0);
  });

  it("validateField enforces the declarative vocabulary", () => {
    const req = { type: "string", name: "x", required: true } as const;
    expect(validateField(req, undefined)).toMatch(/required/);
    expect(validateField({ type: "integer", name: "n", min: 5 }, 3)).toMatch(/at least 5/);
    expect(validateField({ type: "list", name: "l", minItems: 2 }, ["a"])).toMatch(/at least 2/);
  });

  it("fileMatchesAccept matches extensions, MIME types, and wildcards", () => {
    const jsonFile = new File(["{}"], "creds.json", { type: "application/json" });
    const exeFile = new File(["x"], "creds.exe", { type: "application/x-msdownload" });
    const pngFile = new File(["x"], "pic.png", { type: "image/png" });
    expect(fileMatchesAccept(jsonFile, ".json")).toBe(true);
    expect(fileMatchesAccept(exeFile, ".json")).toBe(false);
    expect(fileMatchesAccept(pngFile, "image/*")).toBe(true);
    expect(fileMatchesAccept(jsonFile, undefined)).toBe(true);
  });
});
