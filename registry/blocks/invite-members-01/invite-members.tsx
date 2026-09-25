"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Link2,
  MailPlus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cn,
  ConfirmDialog,
  IconButton,
  Input,
  InputGroup,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  useCopyToClipboard,
} from "@elabs-ai/components-ui";

export type InviteRole = "Admin" | "Member" | "Viewer";

export interface InviteRoleOption {
  role: InviteRole;
  can: string;
}

export interface InviteDraft {
  email: string;
  role: InviteRole;
  valid: boolean;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: InviteRole;
  /** ISO date-time the invite was sent. */
  sentAt: string;
  /** ISO date-time the link stops working. */
  expiresAt: string;
}

export interface InviteMembersProps {
  workspaceName?: string;
  roles?: InviteRoleOption[];
  /** The role a new address gets before the inviter changes it. */
  defaultRole?: InviteRole;
  /** The shareable link; anyone with it joins as `linkRole`. */
  inviteLink?: string;
  linkRole?: InviteRole;
  defaultPending?: PendingInvite[];
  /** Fires with the valid drafts when the inviter sends. */
  onInvite?: (invites: InviteDraft[]) => void;
  onResend?: (invite: PendingInvite) => void;
  onRevoke?: (invite: PendingInvite) => void;
  onCopyLink?: (link: string, copied: boolean) => void;
  /** ISO date-time “now” for the relative expiry labels; defaults to the sample clock. */
  now?: string;
  locale?: string;
  className?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DEFAULT_INVITE_ROLES: InviteRoleOption[] = [
  { role: "Admin", can: "Manage members, billing and every project" },
  { role: "Member", can: "Create and edit projects" },
  { role: "Viewer", can: "Read only" },
];

const DEFAULT_PENDING: PendingInvite[] = [
  {
    id: "1",
    email: "sven@pelican-lines.example",
    role: "Viewer",
    sentAt: "2026-09-23T09:12:00Z",
    expiresAt: "2026-09-30T09:12:00Z",
  },
  {
    id: "2",
    email: "noor.haddad@atlas-hq.example",
    role: "Member",
    sentAt: "2026-09-18T14:40:00Z",
    expiresAt: "2026-09-25T14:40:00Z",
  },
];

const initials = (name: string) =>
  name
    .split(/[ @.]/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Invite people — addresses become chips as you type them (Enter, comma, space or paste),
 * an address that is not an email is kept but flagged and never sent, every chip carries
 * its own role, a share link copies in one click, and pending invites can be resent or
 * revoked — revoking asks first.
 */
export function InviteMembers({
  workspaceName = "Atlas",
  roles = DEFAULT_INVITE_ROLES,
  defaultRole = "Member",
  inviteLink = "https://atlas.example/join/wk_7f3a9c2e",
  linkRole = "Member",
  defaultPending = DEFAULT_PENDING,
  onInvite,
  onResend,
  onRevoke,
  onCopyLink,
  now: nowIso = "2026-09-25T12:00:00Z",
  locale = "en-US",
  className,
}: InviteMembersProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<InviteDraft[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(defaultPending);
  const [sent, setSent] = useState<InviteDraft[] | null>(null);
  const [resent, setResent] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<PendingInvite | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const dateTime = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const now = new Date(nowIso).getTime();

  const daysUntil = (iso: string) => Math.round((new Date(iso).getTime() - now) / 86_400_000);

  function add(raw: string) {
    const parts = raw
      .split(/[,\s;]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length === 0) return;
    setDrafts((prev) => {
      const known = new Set(prev.map((d) => d.email));
      const next = [...prev];
      for (const email of parts) {
        if (known.has(email)) continue;
        known.add(email);
        next.push({ email, role: defaultRole, valid: EMAIL.test(email) });
      }
      return next;
    });
    setSent(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === " ") {
      event.preventDefault();
      add(text);
      setText("");
    } else if (event.key === "Backspace" && text === "" && drafts.length > 0) {
      event.preventDefault();
      setDrafts((prev) => prev.slice(0, -1));
    }
  }

  function send() {
    add(text);
    setText("");
    const ready = drafts.filter((d) => d.valid);
    if (ready.length === 0) return;
    setPending((prev) => [
      ...ready.map((d, i) => ({
        id: `${d.email}-${i}`,
        email: d.email,
        role: d.role,
        sentAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 7 * 86_400_000).toISOString(),
      })),
      ...prev,
    ]);
    onInvite?.(ready);
    setSent(ready);
    setDrafts((prev) => prev.filter((d) => !d.valid));
  }

  const invalid = drafts.filter((d) => !d.valid).length;
  const ready = drafts.length - invalid;

  return (
    <Card className={cn("mx-auto w-full max-w-2xl", className)} data-slot="invite-members">
      <CardHeader>
        <CardTitle>Invite people to {workspaceName}</CardTitle>
        <CardDescription>
          Each person gets an email with a link that works for seven days. You can change their role
          later.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2" data-slot="invite-members-composer">
          <Label htmlFor={inputId}>Email addresses</Label>
          <InputGroup
            className="h-auto min-h-10 flex-wrap gap-1.5 px-2 py-1.5"
            onClick={() => inputRef.current?.focus()}
          >
            {drafts.map((draft) => (
              <span
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-md ps-2 pe-1 text-caption",
                  draft.valid
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-destructive/10 text-destructive-text",
                )}
                data-slot="invite-members-chip"
                key={draft.email}
              >
                {draft.valid ? null : (
                  <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
                )}
                <span className="max-w-48 truncate">{draft.email}</span>
                {draft.valid ? (
                  <Select
                    onValueChange={(value) =>
                      setDrafts((prev) =>
                        prev.map((d) =>
                          d.email === draft.email ? { ...d, role: value as InviteRole } : d,
                        ),
                      )
                    }
                    value={draft.role}
                  >
                    <SelectTrigger
                      aria-label={`Role for ${draft.email}`}
                      autoTitle={false}
                      className="h-6 gap-0.5 border-0 bg-transparent px-1 text-meta shadow-none"
                      onClick={(event) => event.stopPropagation()}
                      size="sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((item) => (
                        <SelectItem key={item.role} value={item.role}>
                          {item.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="sr-only">, not an email address</span>
                )}
                <button
                  aria-label={`Remove ${draft.email}`}
                  className="focus-ring rounded-full p-0.5 hover:bg-foreground/10"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDrafts((prev) => prev.filter((d) => d.email !== draft.email));
                  }}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </span>
            ))}
            <input
              aria-describedby={`${inputId}-hint`}
              autoComplete="off"
              className="min-w-40 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground"
              data-slot="input-group-control"
              id={inputId}
              inputMode="email"
              onBlur={() => {
                if (text.trim()) {
                  add(text);
                  setText("");
                }
              }}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text");
                if (/[,\s;]/.test(pasted)) {
                  event.preventDefault();
                  add(`${text} ${pasted}`);
                  setText("");
                }
              }}
              placeholder={drafts.length === 0 ? "name@company.com, another@company.com" : ""}
              ref={inputRef}
              type="text"
              value={text}
            />
          </InputGroup>
          <p className="text-meta text-muted-foreground" id={`${inputId}-hint`}>
            Enter, comma or space adds an address. Backspace removes the last one. Pick a role on
            each chip.
          </p>
          {invalid > 0 ? (
            <p
              className="flex items-center gap-1.5 text-caption text-destructive-text"
              role="alert"
            >
              <AlertCircle aria-hidden="true" className="size-3.5" />
              {invalid === 1
                ? "One address is not an email and will not be sent."
                : `${invalid} addresses are not emails and will not be sent.`}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span aria-live="polite" className="text-caption text-muted-foreground tabular-nums">
              {ready === 0
                ? "No one to invite yet."
                : ready === 1
                  ? "1 invite ready to send."
                  : `${ready} invites ready to send.`}
            </span>
            <Button disabled={ready === 0} onClick={send}>
              <MailPlus aria-hidden="true" />
              {ready > 1 ? `Send ${ready} invites` : "Send invite"}
            </Button>
          </div>
          {sent ? (
            <Alert role="status" variant="success">
              <Check aria-hidden="true" />
              <AlertTitle>
                {sent.length === 1 ? "Invite sent" : `${sent.length} invites sent`}
              </AlertTitle>
              <AlertDescription>
                {sent.map((d) => d.email).join(", ")} will get an email in a moment.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <Separator />

        <div className="flex flex-col gap-2" data-slot="invite-members-link">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${inputId}-link`}>Or share a link</Label>
            <p className="text-meta text-muted-foreground">
              Anyone with this link joins as a {linkRole.toLowerCase()}. Reset it from Settings if
              it leaks.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Link2
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="ps-9 font-mono text-code"
                id={`${inputId}-link`}
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                value={inviteLink}
              />
            </div>
            <Button
              className="min-w-24"
              onClick={async () => {
                const ok = await copy(inviteLink);
                onCopyLink?.(inviteLink, ok);
              }}
              variant="outline"
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>

        <Separator />

        <section aria-labelledby={`${inputId}-pending`} data-slot="invite-members-pending">
          <h3 className="flex items-center gap-2 text-body font-semibold" id={`${inputId}-pending`}>
            <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
            Pending invites
            <span className="text-caption font-normal text-muted-foreground tabular-nums">
              {pending.length}
            </span>
          </h3>
          {pending.length === 0 ? (
            <p className="pt-3 text-caption text-muted-foreground">
              Nothing outstanding. Everyone you invited has joined.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {pending.map((invite) => {
                const days = daysUntil(invite.expiresAt);
                const expiring = days <= 1;
                return (
                  <li className="flex flex-wrap items-center gap-3 py-3" key={invite.id}>
                    <Avatar className="size-8">
                      <AvatarFallback className="text-meta">
                        {initials(invite.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body font-medium">{invite.email}</span>
                      <span className="text-meta text-muted-foreground">
                        {invite.role} · sent {dateTime.format(new Date(invite.sentAt))} ·{" "}
                        <span className={cn(expiring && "text-warning-text")}>
                          {days < 0 ? "expired" : `expires ${relative.format(days, "day")}`}
                        </span>
                      </span>
                    </div>
                    {resent === invite.id ? (
                      <Badge variant="success">
                        <Check aria-hidden="true" />
                        Sent again
                      </Badge>
                    ) : (
                      <Button
                        onClick={() => {
                          setResent(invite.id);
                          onResend?.(invite);
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <RefreshCw aria-hidden="true" />
                        Resend
                      </Button>
                    )}
                    <IconButton
                      icon={<X />}
                      label={`Revoke the invite to ${invite.email}`}
                      onClick={() => setRevoking(invite)}
                      size="icon-sm"
                      variant="ghost"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </CardContent>
      <ConfirmDialog
        confirmLabel="Revoke invite"
        description="The link in their email stops working straight away. You can invite them again any time."
        onConfirm={() => {
          if (revoking) {
            setPending((prev) => prev.filter((p) => p.id !== revoking.id));
            onRevoke?.(revoking);
          }
          setRevoking(null);
        }}
        onOpenChange={(open) => !open && setRevoking(null)}
        open={revoking !== null}
        title={`Revoke the invite to ${revoking?.email ?? ""}?`}
        tone="destructive"
      />
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

export type AcceptInviteState = "open" | "expired" | "member";

export interface AcceptInviteWorkspace {
  name: string;
  /** Who sent the invite. */
  inviter: { name: string; email: string };
  members: number;
  plan: string;
  /** Chart token that tints the workspace mark, 1–5. */
  tone?: 1 | 2 | 3 | 4 | 5;
}

export interface AcceptInviteProps {
  workspace?: AcceptInviteWorkspace;
  /** The signed-in account the invite would attach to. */
  account?: { email: string; name?: string };
  role?: InviteRole;
  state?: AcceptInviteState;
  onAccept?: () => void;
  onDecline?: () => void;
  onSwitchAccount?: () => void;
  /** `expired`: ask the inviter for a fresh link. `member`: open the workspace. */
  onRequestNewLink?: () => void;
  onOpenWorkspace?: () => void;
  locale?: string;
  className?: string;
  /** Extra content under the card, e.g. a terms line. */
  footer?: ReactNode;
}

const DEFAULT_WORKSPACE: AcceptInviteWorkspace = {
  name: "Atlas",
  inviter: { name: "Ada Okonkwo", email: "ada@atlas-hq.example" },
  members: 48,
  plan: "Business",
  tone: 1,
};

/**
 * The page behind the link — the workspace, who invited you and what you would become,
 * one primary action that names the account it uses, a way out if that is the wrong
 * account, and honest states for a link that expired or a seat you already have.
 */
export function AcceptInvite({
  workspace = DEFAULT_WORKSPACE,
  account = { email: "mei.tanaka@example.com", name: "Mei Tanaka" },
  role = "Member",
  state = "open",
  onAccept,
  onDecline,
  onSwitchAccount,
  onRequestNewLink,
  onOpenWorkspace,
  locale = "en-US",
  className,
  footer,
}: AcceptInviteProps) {
  const [accepted, setAccepted] = useState(false);
  const number = new Intl.NumberFormat(locale);
  const tone = workspace.tone ?? 1;

  return (
    <div
      className={cn("mx-auto flex w-full max-w-md flex-col gap-4", className)}
      data-slot="accept-invite"
      data-state={state}
    >
      <Card>
        <CardHeader className="items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-xl text-title font-semibold"
            style={{
              background: `color-mix(in oklab, var(--chart-${tone}) 18%, var(--card))`,
              color: `var(--chart-${tone})`,
            }}
          >
            {initials(workspace.name)}
          </span>
          {state === "expired" ? (
            <>
              <CardTitle>This invite has expired</CardTitle>
              <CardDescription>
                Links to {workspace.name} work for seven days. Ask {workspace.inviter.name} for a
                new one and you will be in within a minute.
              </CardDescription>
            </>
          ) : state === "member" ? (
            <>
              <CardTitle>You are already in {workspace.name}</CardTitle>
              <CardDescription>
                {account.email} has been a member since before this invite was sent. Nothing to
                accept.
              </CardDescription>
            </>
          ) : accepted ? (
            <>
              <CardTitle>Welcome to {workspace.name}</CardTitle>
              <CardDescription>
                You joined as a {role.toLowerCase()}. {workspace.inviter.name} has been told.
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle>Join {workspace.name}</CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">{workspace.inviter.name}</span> (
                {workspace.inviter.email}) invited you to join as a {role.toLowerCase()}.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl
            className="grid grid-cols-3 divide-x divide-border rounded-lg bg-surface-muted py-3 text-center"
            data-slot="accept-invite-facts"
          >
            <div className="flex flex-col gap-0.5 px-2">
              <dt className="text-meta text-muted-foreground">Members</dt>
              <dd className="inline-flex items-center justify-center gap-1 text-body font-semibold tabular-nums">
                <Users aria-hidden="true" className="size-3.5 text-muted-foreground" />
                {number.format(workspace.members)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 px-2">
              <dt className="text-meta text-muted-foreground">Plan</dt>
              <dd className="text-body font-semibold">{workspace.plan}</dd>
            </div>
            <div className="flex flex-col gap-0.5 px-2">
              <dt className="text-meta text-muted-foreground">Your role</dt>
              <dd className="text-body font-semibold">{role}</dd>
            </div>
          </dl>

          {state === "expired" ? (
            <Button className="w-full" onClick={onRequestNewLink}>
              <RefreshCw aria-hidden="true" />
              Ask {workspace.inviter.name.split(" ")[0]} for a new link
            </Button>
          ) : state === "member" || accepted ? (
            <Button className="w-full" onClick={onOpenWorkspace}>
              Open {workspace.name}
            </Button>
          ) : (
            <>
              <Button
                className="w-full"
                onClick={() => {
                  setAccepted(true);
                  onAccept?.();
                }}
              >
                <Check aria-hidden="true" />
                Join as {account.email}
              </Button>
              <p className="text-center text-caption text-muted-foreground">
                Not you?{" "}
                <button
                  className="focus-ring rounded-sm text-link underline underline-offset-4"
                  onClick={onSwitchAccount}
                  type="button"
                >
                  Switch account
                </button>
              </p>
            </>
          )}
        </CardContent>
        {state === "open" && !accepted ? (
          <CardFooter className="justify-center border-t border-border pt-4">
            <button
              className="focus-ring rounded-sm text-caption text-muted-foreground underline underline-offset-4"
              onClick={onDecline}
              type="button"
            >
              Decline this invite
            </button>
          </CardFooter>
        ) : null}
      </Card>
      {footer ?? (
        <p className="text-center text-meta text-muted-foreground text-pretty">
          Joining shares your name and email with the workspace’s admins. Nothing else.
        </p>
      )}
    </div>
  );
}
