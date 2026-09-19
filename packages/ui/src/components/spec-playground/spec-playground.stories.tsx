import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import {
  SpecPlayground,
  type SpecPlaygroundError,
  type SpecPlaygroundExample,
  type SpecPlaygroundValidation,
} from "./spec-playground";

/** A tiny spec for the stories: a titled list. The validator is a fake, not a real catalog. */
interface ListSpec {
  title: string;
  items: string[];
}

function validateListSpec(json: unknown): SpecPlaygroundValidation<ListSpec> {
  const errors: SpecPlaygroundError[] = [];
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return { ok: false, errors: [{ path: "$", code: "type", message: "must be an object" }] };
  }
  const record = json as Record<string, unknown>;
  if (typeof record.title !== "string") {
    errors.push({ path: "$.title", code: "missing", message: "title is required" });
  }
  if (!Array.isArray(record.items)) {
    errors.push({ path: "$.items", code: "type", message: "items must be an array" });
  } else {
    record.items.forEach((item, index) => {
      if (typeof item !== "string") {
        errors.push({ path: `$.items[${index}]`, code: "type", message: "must be a string" });
      }
    });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, spec: json as ListSpec };
}

function renderListSpec(spec: ListSpec) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{spec.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc ps-5 text-body">
          {spec.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const EXAMPLES: SpecPlaygroundExample[] = [
  {
    id: "launch",
    label: "Launch checklist",
    value: pretty({ title: "Launch checklist", items: ["Freeze scope", "Run the gates", "Ship"] }),
  },
  {
    id: "groceries",
    label: "Groceries",
    value: pretty({ title: "Groceries", items: ["Oats", "Lemons"] }),
  },
];

const meta = {
  title: "Display/SpecPlayground",
  component: SpecPlayground,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A live spec editor: JSON on the left, what it renders on the right (stacked below 1024 px). The host supplies the validator, the renderer and optionally a code editor; errors list under the editor as `path · code · message`, and the render keeps the last valid spec until the text validates again. These stories use the default textarea editor and a fake validator.",
      },
    },
  },
  args: {
    examples: EXAMPLES,
    validate: validateListSpec,
    render: renderListSpec,
    debounceMs: 250,
  },
} satisfies Meta<typeof SpecPlayground<ListSpec>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A valid example, rendered. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Valid");
    await expect(
      canvas.getByText("Launch checklist", { selector: "[data-slot=card-title]" }),
    ).toBeVisible();
  },
};

/** Break the spec, see the validator’s error and the last valid render; fix it again. */
export const EditErrorFix: Story = {
  args: { onChange: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByRole("textbox", { name: "Spec (JSON)" });
    await userEvent.clear(editor);
    await userEvent.type(editor, '{{ "items": [["one"] }');
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("1 error"));
    const error = canvas.getByRole("button", { name: /\$\.title/ });
    await expect(error).toHaveAttribute("data-code", "missing");
    await expect(canvas.getByText("Showing last valid")).toBeVisible();
    await userEvent.click(error);
    await expect(editor).toHaveFocus();
    await userEvent.click(canvas.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("Valid"));
    await expect(canvas.queryByText("Showing last valid")).toBeNull();
  },
};

/** Text that is not JSON: a parse-error chip and no render yet. */
export const ParseError: Story = {
  args: { defaultValue: '{ "title": "Half', examples: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("Parse error");
    await expect(canvas.getByText("Nothing valid to render yet.")).toBeVisible();
  },
};

/** Valid JSON the validator rejects, with nothing valid seen yet. */
export const Invalid: Story = {
  args: { defaultValue: pretty({ title: 3, items: ["ok", 4] }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("2 errors");
    await expect(canvas.getAllByRole("listitem")).toHaveLength(2);
  },
};

/** The examples menu replaces the editor text. */
export const LoadExample: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Load example" }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("menuitem", { name: "Groceries" }));
    await waitFor(() =>
      expect(canvas.getByText("Groceries", { selector: "[data-slot=card-title]" })).toBeVisible(),
    );
  },
};
