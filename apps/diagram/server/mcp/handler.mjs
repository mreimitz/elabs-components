/**
 * DG-35 — Atlas's MCP server: a pure JSON-RPC 2.0 handler, the pattern of
 * `packages/cli/lib/mcp.mjs` (`handleMessage`, the `result`/`error`/`textContent` helpers,
 * the error codes) with two differences: it is async (tools read the disk), and it serves
 * prompts besides tools.
 *
 * R1 (2026-09-27) cut resources: the capabilities do not announce them, but `resources/list`
 * and `resources/read` still answer (an empty list, "not found") for a client that asks.
 *
 * Wire conventions (copied from the CLI):
 *   -32700 Parse error        (http.mjs, unparsable body)
 *   -32600 Invalid Request    (not an object, or an empty batch)
 *   -32601 Method not found   (unknown method; a notification gets no answer)
 *   -32602 Unknown tool / unknown prompt / invalid params
 *   -32002 Resource not found (MCP's own code)
 *   A tool that fails answers a RESULT with `isError: true`, never a JSON-RPC error.
 */

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = { name: "atlas", version: "0.1.0" };

const result = (id, value) => ({ jsonrpc: "2.0", id, result: value });
const error = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
export const textContent = (text) => ({ content: [{ type: "text", text }] });

/**
 * The JSON-Schema subset every Atlas tool schema uses: `type` (object/string/number/integer/
 * boolean/array), `properties`, `required`, `additionalProperties: false`, `enum`, `items`.
 * @returns {string | null} the first problem, or null
 */
export function checkArgs(schema, value, at = "arguments") {
  const type = schema.type;
  if (type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return `${at} must be an object.`;
    for (const key of schema.required ?? []) {
      if (value[key] === undefined) return `${at}.${key} is required.`;
    }
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      if (!sub) {
        if (schema.additionalProperties === false) return `${at}.${key} is not a known argument.`;
        continue;
      }
      const problem = checkArgs(sub, v, `${at}.${key}`);
      if (problem) return problem;
    }
    return null;
  }
  if (type === "array") {
    if (!Array.isArray(value)) return `${at} must be an array.`;
    for (let i = 0; i < value.length; i++) {
      const problem = schema.items ? checkArgs(schema.items, value[i], `${at}[${i}]`) : null;
      if (problem) return problem;
    }
    return null;
  }
  if (type === "integer" && !Number.isInteger(value)) return `${at} must be an integer.`;
  if (type === "number" && typeof value !== "number") return `${at} must be a number.`;
  if (type === "string" && typeof value !== "string") return `${at} must be a string.`;
  if (type === "boolean" && typeof value !== "boolean") return `${at} must be true or false.`;
  if (schema.enum && !schema.enum.includes(value)) {
    return `${at} must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}.`;
  }
  return null;
}

/** A tool's return value → an MCP `tools/call` result. */
function toResult(value) {
  if (value && typeof value === "object" && Array.isArray(value.content)) return value;
  return textContent(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

/** A thrown error → an `isError` result the model can read and act on. */
function toErrorResult(e) {
  const code = e && typeof e === "object" && "extra" in e ? e.extra?.code : undefined;
  const message = e instanceof Error ? e.message : String(e);
  return { ...textContent(code ? `${message} (code: ${code})` : message), isError: true };
}

async function callTool(params, ctx) {
  const tool = ctx.tools.get(params?.name);
  if (!tool) return null;
  const args = params.arguments ?? {};
  const problem = checkArgs(tool.inputSchema, args);
  if (problem) return { ...textContent(problem), isError: true };
  try {
    return toResult(await tool.handler(args, ctx));
  } catch (e) {
    return toErrorResult(e);
  }
}

/**
 * One JSON-RPC message → its response, or null for a notification.
 * @param {unknown} msg
 * @param {{ tools: { list(): object[], get(name: string): any }, prompts: { list(): Promise<object[]>, get(name: string, args: object): Promise<object|null> }, resources: { list(): Promise<object[]>, read(uri: string): Promise<object|null> } }} ctx
 */
export async function handleMessage(msg, ctx) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
    return error(null, -32600, "Invalid Request");
  }
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize": {
      const requested = params?.protocolVersion;
      return result(id, {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : SUPPORTED_PROTOCOL_VERSIONS[0],
        capabilities: { tools: {}, prompts: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "Atlas: architecture diagrams as YAML files in a local workspace. Read the author-diagram prompt first.",
      });
    }
    case "notifications/initialized":
    case "initialized":
      return null;
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, {
        tools: ctx.tools.list().map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });
    case "tools/call": {
      const out = await callTool(params, ctx);
      if (!out) return error(id, -32602, `Unknown tool: ${params?.name}`);
      return result(id, out);
    }
    case "prompts/list":
      return result(id, { prompts: await ctx.prompts.list() });
    case "prompts/get": {
      let prompt;
      try {
        prompt = await ctx.prompts.get(params?.name, params?.arguments ?? {});
      } catch (e) {
        return error(id, -32602, e instanceof Error ? e.message : String(e));
      }
      if (!prompt) return error(id, -32602, `Unknown prompt: ${params?.name}`);
      return result(id, prompt);
    }
    case "resources/list":
      return result(id, { resources: await ctx.resources.list() });
    case "resources/read": {
      let read;
      try {
        read = await ctx.resources.read(params?.uri);
      } catch (e) {
        return error(id, -32602, e instanceof Error ? e.message : String(e));
      }
      // MCP's "resource not found" code (spec: server/resources, error handling).
      if (!read) return error(id, -32002, `Resource not found: ${params?.uri}`);
      return result(id, read);
    }
    default:
      if (isNotification) return null;
      return error(id, -32601, `Method not found: ${method}`);
  }
}
