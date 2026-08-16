import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { Input } from "../input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../form";
import { FieldRow } from "./field-row";

describe("FieldRow", () => {
  it("renders outside any FormProvider / react-hook-form context", () => {
    expect(() =>
      render(
        <FieldRow label="Standalone">
          <Input />
        </FieldRow>,
      ),
    ).not.toThrow();
  });

  it("clicking the label focuses the control (native htmlFor/id association)", async () => {
    render(
      <FieldRow label="Name">
        <Input />
      </FieldRow>,
    );
    await userEvent.click(screen.getByText("Name"));
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("composes aria-describedby from description + error ids that resolve to the real rendered nodes", () => {
    render(
      <FieldRow label="Name" description="Your full name" error="Required">
        <Input />
      </FieldRow>,
    );
    const input = screen.getByRole("textbox");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const ids = describedBy!.split(" ");
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(document.getElementById(id)).not.toBeNull();
    }
    expect(screen.getByText("Your full name").id).toBe(ids[0]);
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Required");
    expect(error.id).toBe(ids[1]);
  });

  it("sets aria-invalid only when an error is present", () => {
    const { rerender } = render(
      <FieldRow label="Name">
        <Input />
      </FieldRow>,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "false");

    rerender(
      <FieldRow label="Name" error="Required">
        <Input />
      </FieldRow>,
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("omits aria-describedby entirely when there is no description and no error", () => {
    render(
      <FieldRow label="Name">
        <Input />
      </FieldRow>,
    );
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
  });

  // Regression lock: Radix `Slot` merges CHILD props OVER slot props, so a
  // control carrying its own `id` used to silently win — `<Label htmlFor>`
  // then pointed at an element that did not exist and clicking the label
  // focused nothing. FieldRow now composes with the child's own id.
  it("keeps the label associated when the control supplies its own id", async () => {
    render(
      <FieldRow label="Email" description="Work address">
        <Input id="consumer-owned-id" />
      </FieldRow>,
    );
    const input = screen.getByRole("textbox");
    expect(input.id).toBe("consumer-owned-id");
    expect(screen.getByText("Email")).toHaveAttribute("for", "consumer-owned-id");
    await userEvent.click(screen.getByText("Email"));
    expect(input).toHaveFocus();
  });

  // Same root cause: a child's own `aria-describedby` used to REPLACE the
  // composed one, so the help and error text were never announced.
  it("composes with (does not discard) a control's own aria-describedby", () => {
    render(
      <>
        <span id="consumer-hint">Extra hint</span>
        <FieldRow label="Name" description="Your full name" error="Required">
          <Input aria-describedby="consumer-hint" />
        </FieldRow>
      </>,
    );
    const [hintId, descriptionId, errorId, ...rest] = screen
      .getByRole("textbox")
      .getAttribute("aria-describedby")!
      .split(" ");
    expect(rest).toHaveLength(0);
    expect(hintId).toBe("consumer-hint");
    for (const id of [hintId, descriptionId, errorId]) {
      expect(document.getElementById(id!)).not.toBeNull();
    }
    expect(document.getElementById(descriptionId!)).toHaveTextContent("Your full name");
    expect(document.getElementById(errorId!)).toHaveTextContent("Required");
  });

  // #354 — a field rendered through FieldRow must produce ACCESSIBLE MARKUP
  // EQUIVALENT to the same field rendered through the existing react-hook-form
  // path (Form/FormField/FormItem/FormLabel/FormControl/FormDescription/
  // FormMessage), proven by a real assertion — not just claimed.
  it("produces markup equivalent to the RHF-bound Form family for the same field shape", async () => {
    function RhfField() {
      const form = useForm({ defaultValues: { name: "" }, mode: "onChange" });
      // Force a real validation error into RHF field state (not merely a
      // static string prop), so FormControl/FormMessage compute their
      // aria-invalid/aria-describedby/error text from the SAME code path a
      // real consumer hits.
      useEffect(() => {
        void form.trigger("name");
      }, [form]);
      return (
        <Form {...form}>
          <FormField
            control={form.control}
            name="name"
            rules={{ required: "Required" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>Your full name</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </Form>
      );
    }

    const { unmount } = render(<RhfField />);
    const rhfInput = await screen.findByRole("textbox");
    await waitFor(() => expect(rhfInput).toHaveAttribute("aria-invalid", "true"));
    const rhfLabel = screen.getByText("Name");
    const rhfDescribedBy = rhfInput.getAttribute("aria-describedby")!.split(" ");
    expect(rhfLabel.tagName).toBe("LABEL");
    expect(rhfLabel).toHaveAttribute("for", rhfInput.id);
    expect(rhfDescribedBy).toHaveLength(2);
    for (const id of rhfDescribedBy) expect(document.getElementById(id)).not.toBeNull();
    unmount();

    render(
      <FieldRow label="Name" description="Your full name" error="Required">
        <Input />
      </FieldRow>,
    );
    const frInput = screen.getByRole("textbox");
    const frLabel = screen.getByText("Name");
    const frDescribedBy = frInput.getAttribute("aria-describedby")!.split(" ");

    // Equivalent SHAPE of accessible markup (same relationship types) — not
    // identical id strings, since each side mints its own useId().
    expect(frLabel.tagName).toBe(rhfLabel.tagName);
    expect(frLabel).toHaveAttribute("for", frInput.id);
    expect(frDescribedBy).toHaveLength(rhfDescribedBy.length);
    for (const id of frDescribedBy) expect(document.getElementById(id)).not.toBeNull();
    expect(frInput).toHaveAttribute("aria-invalid", "true");
  });
});
