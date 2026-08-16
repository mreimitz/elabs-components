import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../button";
import { Input } from "../input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";

const schema = z.object({ email: z.string().email("Enter a valid email") });

function DemoForm() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})} className="w-72 space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormDescription>We'll never share it.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}

const meta = {
  title: "Forms/Form",
  component: DemoForm,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "react-hook-form + zod integration layer. Compose FormField, FormItem, FormLabel, FormControl, FormDescription, and FormMessage inside a Form provider.",
      },
    },
  },
} satisfies Meta<typeof DemoForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  // Submits with an invalid email and confirms the inline error message appears.
  play: async ({ canvas, userEvent }) => {
    const submit = canvas.getByRole("button", { name: /submit/i });
    await userEvent.click(submit);
    const error = await canvas.findByText(/valid email/i);
    await expect(error).toBeInTheDocument();
  },
};
