"use client";

/**
 * The right-hand panel: one form per kind of node. Every form edits plain node data through
 * `onChange`; the designer decides what that means (state, undo history, a save call).
 */
import { type ReactNode } from "react";
import { KeyRound, Plus, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  cn,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldRoot,
  IconButton,
  Input,
  ListEditor,
  NumberInput,
  SegmentedField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SliderNumber,
  Switch,
  Textarea,
} from "@elabs-ai/components-ui";
import {
  CAPABILITY_PORTS,
  nodeTitle,
  type AgentData,
  type Autonomy,
  type DesignerData,
  type DesignerNode,
  type McpServerData,
  type RouterData,
} from "./types";

export interface NodeInspectorProps {
  node: DesignerNode;
  /** The nodes attached to this agent (agents only). */
  equipment: DesignerNode[];
  /** The agents this capability is attached to (capabilities only). */
  usedBy: DesignerNode[];
  onChange: (patch: Partial<DesignerData>) => void;
  onSelect: (nodeId: string) => void;
  onDetach: (nodeId: string) => void;
  onDelete: () => void;
}

const AUTONOMY: { value: Autonomy; label: string; meaning: string }[] = [
  {
    value: "suggest",
    label: "Suggest",
    meaning: "Drafts and proposes. A person carries out every action.",
  },
  {
    value: "act-with-approval",
    label: "Ask first",
    meaning: "Reads freely. Asks before any tool marked “ask first”.",
  },
  {
    value: "autonomous",
    label: "Autonomous",
    meaning: "Acts on its own within its tools, steps and budget.",
  },
];

const MODELS = [
  ["Anthropic", "Claude Opus"],
  ["Anthropic", "Claude Sonnet"],
  ["Anthropic", "Claude Haiku"],
  ["Mistral", "Mistral Large"],
  ["Self-hosted", "Llama 70B"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h4 className="text-eyebrow text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  description,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  mono?: boolean;
}) {
  return (
    <FieldRoot>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl>
        <Input
          className={cn(mono && "font-mono")}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      </FieldControl>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </FieldRoot>
  );
}

function PickField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-medium">{label}</span>
      <Select onValueChange={onChange} value={value}>
        {/* A `role="combobox"` button is never named by its contents, so it carries the label. */}
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Agent                                                                       */
/* -------------------------------------------------------------------------- */

function AgentForm({
  data,
  equipment,
  onChange,
  onSelect,
  onDetach,
}: Pick<NodeInspectorProps, "equipment" | "onChange" | "onSelect" | "onDetach"> & {
  data: AgentData;
}) {
  const autonomy = AUTONOMY.find((option) => option.value === data.autonomy)!;
  return (
    <>
      <Section title="Identity">
        <TextField label="Name" onChange={(name) => onChange({ name })} value={data.name} />
        <TextField
          description="One line. Other agents read this to decide whether to hand work over."
          label="Role"
          onChange={(role) => onChange({ role })}
          value={data.role}
        />
        <FieldRoot>
          <FieldLabel>Instructions</FieldLabel>
          <FieldControl>
            <Textarea
              onChange={(event) => onChange({ instructions: event.target.value })}
              rows={7}
              value={data.instructions}
            />
          </FieldControl>
          <FieldDescription>
            Say what good looks like and when to stop. Put reusable know-how in a skill instead.
          </FieldDescription>
        </FieldRoot>
      </Section>

      <Section title="Autonomy and limits">
        <SegmentedField
          label="How much may it do alone?"
          onValueChange={(value) => onChange({ autonomy: value as Autonomy })}
          options={AUTONOMY.map(({ value, label }) => ({ value, label }))}
          size="sm"
          value={data.autonomy}
        />
        <p className="text-caption text-muted-foreground">{autonomy.meaning}</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldRoot>
            <FieldLabel>Max steps</FieldLabel>
            <FieldControl>
              <NumberInput
                max={50}
                min={1}
                onValueChange={(value) => onChange({ maxSteps: value ?? 1 })}
                value={data.maxSteps}
              />
            </FieldControl>
          </FieldRoot>
          <FieldRoot>
            <FieldLabel>Budget a run</FieldLabel>
            <FieldControl>
              <NumberInput
                formatOptions={{ style: "currency", currency: "USD" }}
                max={20}
                min={0.01}
                onValueChange={(value) => onChange({ budgetUsd: value ?? 0.01 })}
                step={0.05}
                value={data.budgetUsd}
              />
            </FieldControl>
          </FieldRoot>
        </div>
      </Section>

      <Section title="Equipment">
        {CAPABILITY_PORTS.map((port) => {
          const items = equipment.filter((item) => item.data.kind === port.kind);
          return (
            <div className="flex flex-col gap-1" key={port.kind}>
              <div className="flex items-center justify-between text-caption">
                <span className="font-medium">{port.label}</span>
                <span className="text-meta text-muted-foreground tabular-nums">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="text-meta text-muted-foreground">
                  None. Pick one from the palette while this agent is selected.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {items.map((item) => (
                    <li
                      className="flex items-center gap-1 rounded-md border border-border ps-2"
                      key={item.id}
                    >
                      <button
                        className="min-w-0 flex-1 truncate rounded-sm py-1 text-start text-caption focus-ring hover:underline"
                        onClick={() => onSelect(item.id)}
                        type="button"
                      >
                        {nodeTitle(item.data)}
                      </button>
                      <IconButton
                        icon={<X aria-hidden="true" />}
                        label={`Detach ${nodeTitle(item.data)}`}
                        onClick={() => onDetach(item.id)}
                        size="icon-sm"
                        variant="ghost"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </Section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* MCP server                                                                  */
/* -------------------------------------------------------------------------- */

function McpForm({
  data,
  onChange,
}: {
  data: McpServerData;
  onChange: NodeInspectorProps["onChange"];
}) {
  const setTool = (name: string, patch: Partial<McpServerData["tools"][number]>) =>
    onChange({
      tools: data.tools.map((tool) => (tool.name === name ? { ...tool, ...patch } : tool)),
    });
  const on = data.tools.filter((tool) => tool.enabled);
  return (
    <>
      <Section title="Connection">
        {data.auth === "connected" ? (
          <p className="flex items-center gap-2 text-caption">
            <Badge variant="success">Connected</Badge>
            <span className="text-muted-foreground">as the workspace service account</span>
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-warning bg-warning/10 p-3">
            <p className="flex items-center gap-2 text-caption font-medium">
              <KeyRound aria-hidden="true" className="size-4 text-warning" />
              {data.auth === "error"
                ? "The last connection attempt failed"
                : "Nobody has signed in yet"}
            </p>
            <p className="text-meta text-muted-foreground">
              Agents using this server will fail at the first tool call.
            </p>
            <Button
              className="self-start"
              onClick={() => onChange({ auth: "connected" })}
              size="sm"
              variant="outline"
            >
              {data.auth === "error" ? "Reconnect" : "Sign in"}
            </Button>
          </div>
        )}
        <TextField label="Server URL" mono onChange={(url) => onChange({ url })} value={data.url} />
        <PickField
          label="Transport"
          onChange={(transport) => onChange({ transport: transport as McpServerData["transport"] })}
          options={["Streamable HTTP", "stdio"]}
          value={data.transport}
        />
      </Section>

      <Section title={`Tools · ${on.length} of ${data.tools.length} on`}>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              onChange({
                tools: data.tools.map((tool) => ({ ...tool, enabled: tool.access === "read" })),
              })
            }
            size="sm"
            variant="outline"
          >
            Read-only
          </Button>
          <Button
            onClick={() =>
              onChange({
                tools: data.tools.map((tool) => ({
                  ...tool,
                  requiresApproval: tool.access === "write",
                })),
              })
            }
            size="sm"
            variant="outline"
          >
            Ask before every write
          </Button>
        </div>
        <ul className="flex flex-col divide-y divide-border-strong">
          {data.tools.map((tool) => (
            <li className="flex flex-col gap-1.5 py-2.5" key={tool.name}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-caption font-medium">
                  {tool.name}
                </span>
                <Badge variant={tool.access === "write" ? "warning" : "secondary"}>
                  {tool.access}
                </Badge>
                <Switch
                  aria-label={`${tool.name} enabled`}
                  checked={tool.enabled}
                  onCheckedChange={(enabled) => setTool(tool.name, { enabled })}
                />
              </div>
              <p className="text-meta text-muted-foreground">{tool.description}</p>
              {tool.access === "write" && tool.enabled ? (
                <label className="flex items-center justify-between gap-2 rounded-md bg-surface-muted px-2 py-1 text-meta">
                  Ask a person every time
                  <Switch
                    checked={tool.requiresApproval}
                    onCheckedChange={(requiresApproval) => setTool(tool.name, { requiresApproval })}
                  />
                </label>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Router                                                                      */
/* -------------------------------------------------------------------------- */

function RouterForm({
  data,
  onChange,
}: {
  data: RouterData;
  onChange: NodeInspectorProps["onChange"];
}) {
  const setBranch = (id: string, patch: Partial<RouterData["branches"][number]>) =>
    onChange({
      branches: data.branches.map((branch) =>
        branch.id === id ? { ...branch, ...patch } : branch,
      ),
    });
  return (
    <>
      <Section title="Router">
        <TextField label="Question" onChange={(name) => onChange({ name })} value={data.name} />
      </Section>
      <Section title="Branches">
        <p className="text-meta text-muted-foreground">
          Checked top to bottom; the first one that holds wins.
        </p>
        <ul className="flex flex-col gap-2">
          {data.branches.map((branch, index) => (
            <li
              className="flex flex-col gap-1.5 rounded-md border border-border p-2"
              key={branch.id}
            >
              <div className="flex items-center gap-1">
                <Input
                  aria-label={`Branch ${index + 1} name`}
                  onChange={(event) => setBranch(branch.id, { label: event.target.value })}
                  value={branch.label}
                />
                <IconButton
                  disabled={data.branches.length <= 2}
                  disabledReason="A router needs two branches"
                  icon={<Trash2 aria-hidden="true" />}
                  label={`Remove branch ${branch.label}`}
                  onClick={() =>
                    onChange({ branches: data.branches.filter((item) => item.id !== branch.id) })
                  }
                  size="icon-sm"
                  variant="ghost"
                />
              </div>
              <Input
                aria-label={`Branch ${index + 1} condition`}
                className="text-caption"
                onChange={(event) => setBranch(branch.id, { condition: event.target.value })}
                value={branch.condition}
              />
            </li>
          ))}
        </ul>
        <Button
          className="self-start"
          onClick={() =>
            onChange({
              branches: [
                ...data.branches,
                { id: `b${Date.now().toString(36)}`, label: "New branch", condition: "when…" },
              ],
            })
          }
          size="sm"
          variant="outline"
        >
          <Plus aria-hidden="true" />
          Add branch
        </Button>
      </Section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Everything else                                                             */
/* -------------------------------------------------------------------------- */

function UsedBy({ usedBy, onSelect }: Pick<NodeInspectorProps, "usedBy" | "onSelect">) {
  return (
    <Section title="Used by">
      {usedBy.length === 0 ? (
        <p className="text-caption text-muted-foreground">Not attached to any agent.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {usedBy.map((agent) => (
            <li key={agent.id}>
              <Button onClick={() => onSelect(agent.id)} size="sm" variant="outline">
                {nodeTitle(agent.data)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function NodeInspector({
  node,
  equipment,
  usedBy,
  onChange,
  onSelect,
  onDetach,
  onDelete,
}: NodeInspectorProps) {
  const { data } = node;
  return (
    <div className="flex flex-col gap-4">
      {data.kind === "agent" ? (
        <AgentForm
          data={data}
          equipment={equipment}
          onChange={onChange}
          onDetach={onDetach}
          onSelect={onSelect}
        />
      ) : null}

      {data.kind === "mcp" ? <McpForm data={data} onChange={onChange} /> : null}
      {data.kind === "router" ? <RouterForm data={data} onChange={onChange} /> : null}

      {data.kind === "model" ? (
        <Section title="Model">
          <PickField
            label="Model"
            onChange={(value) => {
              const [provider, model] = MODELS.find(([, name]) => name === value) ?? MODELS[1];
              onChange({ provider, model });
            }}
            options={MODELS.map(([, name]) => name)}
            value={data.model}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-caption font-medium" id={`${node.id}-temperature`}>
              Temperature
            </span>
            <SliderNumber
              aria-labelledby={`${node.id}-temperature`}
              max={1}
              min={0}
              onValueChange={(value) => onChange({ temperature: value ?? 0 })}
              precision={1}
              step={0.1}
              value={data.temperature}
            />
            <p className="text-meta text-muted-foreground">
              0 for extraction and scoring; higher for writing.
            </p>
          </div>
          <FieldRoot>
            <FieldLabel>Max output tokens</FieldLabel>
            <FieldControl>
              <NumberInput
                max={32000}
                min={256}
                onValueChange={(value) => onChange({ maxOutputTokens: value ?? 256 })}
                step={256}
                value={data.maxOutputTokens}
              />
            </FieldControl>
          </FieldRoot>
        </Section>
      ) : null}

      {data.kind === "skill" ? (
        <Section title="Skill">
          <p className="text-body">{data.description}</p>
          <dl className="grid grid-cols-3 gap-2 text-caption">
            {[
              ["Version", data.version],
              ["From", data.source],
              ["Files", String(data.files)],
            ].map(([term, value]) => (
              <div className="flex flex-col" key={term}>
                <dt className="text-meta text-muted-foreground">{term}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-meta text-muted-foreground">
            Loaded only when the agent decides it is relevant, so a long skill costs nothing on the
            runs that do not need it.
          </p>
        </Section>
      ) : null}

      {data.kind === "knowledge" ? (
        <Section title="Knowledge source">
          <TextField label="Name" onChange={(name) => onChange({ name })} value={data.name} />
          <TextField
            label="System"
            onChange={(system) => onChange({ system })}
            value={data.system}
          />
          <p className="text-caption text-muted-foreground">
            {data.documents.toLocaleString("en-US")} documents · synced {data.synced}
          </p>
        </Section>
      ) : null}

      {data.kind === "memory" ? (
        <Section title="Memory">
          <TextField label="Name" onChange={(name) => onChange({ name })} value={data.name} />
          <PickField
            label="Scope"
            onChange={(scope) => onChange({ scope: scope as typeof data.scope })}
            options={["This run", "Per customer", "Workspace"]}
            value={data.scope}
          />
          <FieldRoot>
            <FieldLabel>Keep for (days)</FieldLabel>
            <FieldControl>
              <NumberInput
                max={3650}
                min={0}
                onValueChange={(value) => onChange({ retentionDays: value ?? 0 })}
                value={data.retentionDays}
              />
            </FieldControl>
          </FieldRoot>
        </Section>
      ) : null}

      {data.kind === "trigger" ? (
        <Section title="Trigger">
          <TextField label="Name" onChange={(name) => onChange({ name })} value={data.name} />
          <TextField
            label="Source"
            onChange={(source) => onChange({ source })}
            value={data.source}
          />
          <TextField
            label="Detail"
            onChange={(detail) => onChange({ detail })}
            value={data.detail}
          />
        </Section>
      ) : null}

      {data.kind === "guardrail" ? (
        <Section title="Guardrail">
          <TextField label="Name" onChange={(name) => onChange({ name })} value={data.name} />
          <div className="flex flex-col gap-1.5">
            <span className="text-caption font-medium">Checks</span>
            <ListEditor
              addLabel="Add check"
              onValueChange={(checks) => onChange({ checks })}
              placeholder="What must hold…"
              value={data.checks}
            />
          </div>
          <PickField
            label="When a check fails"
            onChange={(onFail) => onChange({ onFail: onFail as typeof data.onFail })}
            options={["block", "escalate", "redact"]}
            value={data.onFail}
          />
        </Section>
      ) : null}

      {data.kind === "approval" ? (
        <Section title="Human approval">
          <TextField label="Name" onChange={(name) => onChange({ name })} value={data.name} />
          <TextField
            label="Who approves"
            onChange={(approvers) => onChange({ approvers })}
            value={data.approvers}
          />
          <PickField
            label="Where they are asked"
            onChange={(channel) => onChange({ channel })}
            options={["Slack", "Microsoft Teams", "Email", "In the app"]}
            value={data.channel}
          />
          <FieldRoot>
            <FieldLabel>Answer within (hours)</FieldLabel>
            <FieldControl>
              <NumberInput
                max={168}
                min={1}
                onValueChange={(value) => onChange({ slaHours: value ?? 1 })}
                value={data.slaHours}
              />
            </FieldControl>
            <FieldDescription>After that the run takes the Rejected path.</FieldDescription>
          </FieldRoot>
        </Section>
      ) : null}

      {data.kind === "action" ? (
        <Section title="Action">
          <TextField label="Name" onChange={(name) => onChange({ name })} value={data.name} />
          <TextField
            label="System"
            onChange={(system) => onChange({ system })}
            value={data.system}
          />
          <TextField
            label="Operation"
            mono
            onChange={(operation) => onChange({ operation })}
            value={data.operation}
          />
          <label className="flex items-center justify-between gap-2 text-caption">
            Changes data in that system
            <Switch checked={data.write} onCheckedChange={(write) => onChange({ write })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-caption">
            Moves money or books to the ledger
            <Switch
              checked={Boolean(data.sensitive)}
              onCheckedChange={(sensitive) => onChange({ sensitive })}
            />
          </label>
        </Section>
      ) : null}

      {data.kind === "note" ? (
        <Section title="Note">
          <FieldRoot>
            <FieldLabel>Text</FieldLabel>
            <FieldControl>
              <Textarea
                onChange={(event) => onChange({ text: event.target.value })}
                rows={6}
                value={data.text}
              />
            </FieldControl>
          </FieldRoot>
        </Section>
      ) : null}

      {["model", "skill", "mcp", "knowledge", "memory"].includes(data.kind) ? (
        <UsedBy onSelect={onSelect} usedBy={usedBy} />
      ) : null}

      <Section title="Node">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-meta text-muted-foreground">{node.id}</span>
          {/* Removal is undoable from the toolbar, so it does not ask first. */}
          <Button onClick={onDelete} size="sm" variant="outline">
            <Trash2 aria-hidden="true" />
            Remove
          </Button>
        </div>
      </Section>
    </div>
  );
}
