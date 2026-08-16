"use client";

import { Input, Label } from "@elabs-ai/components-ui";

export interface FieldProps {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}

/** A labelled input with the correct `autocomplete`/`type` hints for a checkout step. */
export function Field({ id, label, placeholder, type = "text", autoComplete }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} placeholder={placeholder} autoComplete={autoComplete} />
    </div>
  );
}
