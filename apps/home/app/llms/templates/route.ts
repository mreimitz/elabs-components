/** `/llms/templates` — every template as text for agents (RM-149); see `lib/llms-templates.ts`. */
import { renderTemplatesText } from "../../../lib/llms-templates";

export function GET() {
  return new Response(renderTemplatesText(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const dynamic = "force-static";
