import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageForm } from "./message-form";
import {
  fieldSpecSchema,
  formSpecSchema,
  normalizeFormSpec,
  validateField,
  type FormSpec,
} from "./message-form-spec";

const simpleSpec: FormSpec = {
  formName: "signup",
  title: "Sign up",
  fields: [
    { type: "string", name: "name", label: "Name", required: true },
    { type: "string", name: "email", label: "Email", format: "email", required: true },
  ],
};

describe("MessageForm — rendering", () => {
  it("renders the title, fields, and a submit button", () => {
    render(<MessageForm spec={simpleSpec} />);
    expect(screen.getByText("Sign up")).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("labels the form via aria-labelledby pointing at the title", () => {
    render(<MessageForm spec={simpleSpec} />);
    const form = screen.getByRole("form", { name: "Sign up" });
    expect(form).toBeInTheDocument();
  });

  it("marks required fields with aria-required", () => {
    render(<MessageForm spec={simpleSpec} />);
    expect(screen.getByLabelText(/Name/)).toHaveAttribute("aria-required", "true");
  });

  it("uses the humanized name when no label is given", () => {
    render(
      <MessageForm spec={{ formName: "f", fields: [{ type: "string", name: "first_name" }] }} />,
    );
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
  });
});

describe("MessageForm — accessibility of field types", () => {
  it("sets aria-required on a required number field", () => {
    render(
      <MessageForm
        spec={{
          formName: "f",
          fields: [{ type: "integer", name: "age", label: "Age", required: true }],
        }}
      />,
    );
    expect(screen.getByLabelText(/Age/)).toHaveAttribute("aria-required", "true");
  });

  it("labels a multi-enum as a group without double-labelling the first checkbox", () => {
    render(
      <MessageForm
        spec={{
          formName: "f",
          fields: [
            {
              type: "multi-enum",
              name: "interests",
              label: "Interests",
              options: ["Alpha", "Beta"],
            },
          ],
        }}
      />,
    );
    // The group is named by the field label…
    expect(screen.getByRole("group", { name: "Interests" })).toBeInTheDocument();
    // …and each checkbox's accessible name is JUST its option (no "Interests Alpha").
    expect(screen.getByRole("checkbox", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Beta" })).toBeInTheDocument();
  });

  it("enforces a required boolean (must be checked)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <MessageForm
        spec={{
          formName: "f",
          fields: [{ type: "boolean", name: "terms", label: "Accept terms", required: true }],
        }}
        onSubmit={onSubmit}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Accept terms/ }));
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ formName: "f", values: { terms: true } });
  });
});

describe("MessageForm — never throws / fallback", () => {
  it("renders a fallback for a non-object spec (does not throw)", () => {
    render(<MessageForm spec={"nope" as unknown} />);
    expect(screen.getByText(/could not|missing or malformed/i)).toBeInTheDocument();
  });

  it("renders a fallback for a valid-but-empty spec when not streaming", () => {
    render(<MessageForm spec={{ formName: "x", fields: [] }} />);
    expect(screen.getByText(/no fields/i)).toBeInTheDocument();
  });

  it("renders a skeleton (not a fallback) for an empty spec while streaming", () => {
    const { container } = render(<MessageForm spec={{ formName: "x", fields: [] }} streaming />);
    expect(screen.queryByText(/no fields/i)).not.toBeInTheDocument();
    // Skeleton placeholders are aria-hidden decoration.
    expect(container.querySelector('[aria-hidden="true"] .animate-pulse')).not.toBeNull();
  });

  it("drops half-arrived fields while streaming instead of crashing", () => {
    render(
      <MessageForm
        streaming
        spec={{
          formName: "x",
          fields: [
            { type: "string", name: "ok", label: "OK" },
            { name: "partial" } as never, // no discriminator yet
          ],
        }}
      />,
    );
    expect(screen.getByLabelText("OK")).toBeInTheDocument();
    expect(screen.queryByLabelText("Partial")).not.toBeInTheDocument();
  });
});

describe("MessageForm — validation (submit)", () => {
  it("blocks submit and shows an inline error when a required field is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MessageForm spec={simpleSpec} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText("This field is required.").length).toBeGreaterThan(0);
  });

  it("shows a format error for an invalid email", async () => {
    const user = userEvent.setup();
    render(<MessageForm spec={simpleSpec} onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/Name/), "Dana");
    await user.type(screen.getByLabelText(/Email/), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("submits { formName, values } when valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MessageForm spec={simpleSpec} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Name/), "Dana");
    await user.type(screen.getByLabelText(/Email/), "dana@acme.com");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      formName: "signup",
      values: expect.objectContaining({ name: "Dana", email: "dana@acme.com" }),
    });
  });
});

describe("MessageForm — controlled + submitted", () => {
  it("reflects controlled values and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MessageForm spec={simpleSpec} values={{ name: "Seed" }} onChange={onChange} />);
    expect(screen.getByLabelText(/Name/)).toHaveValue("Seed");
    await user.type(screen.getByLabelText(/Email/), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("renders an inert submitted state with values visible and no submit button", () => {
    render(<MessageForm spec={simpleSpec} submitted values={{ name: "Dana", email: "d@a.co" }} />);
    expect(screen.getByLabelText(/Name/)).toHaveValue("Dana");
    expect(screen.getByLabelText(/Name/)).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });
});

describe("message-form-spec", () => {
  it("formSpecSchema accepts a well-formed spec", () => {
    expect(formSpecSchema.safeParse(simpleSpec).success).toBe(true);
  });

  it("rejects a password/credential field (no such type/format)", () => {
    expect(fieldSpecSchema.safeParse({ type: "password", name: "pw" }).success).toBe(false);
    expect(
      fieldSpecSchema.safeParse({ type: "string", name: "pw", format: "password" }).success,
    ).toBe(false);
  });

  it("normalizeFormSpec drops invalid fields but keeps valid ones", () => {
    const result = normalizeFormSpec({
      formName: "f",
      fields: [{ type: "string", name: "ok" }, { type: "file", name: "bad" }, { nope: true }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.fields).toHaveLength(1);
      expect(result.spec.fields[0]?.name).toBe("ok");
    }
  });

  it("validateField enforces the declarative vocabulary", () => {
    const req = { type: "string", name: "x", required: true } as const;
    expect(validateField(req, undefined)).toMatch(/required/);
    expect(validateField({ type: "integer", name: "n", min: 5 }, 3)).toMatch(/at least 5/);
    expect(validateField({ type: "integer", name: "n" }, 3.5)).toMatch(/whole number/);
    expect(validateField({ type: "string", name: "u", format: "uri" }, "http://ok.com")).toBeNull();
  });
});
